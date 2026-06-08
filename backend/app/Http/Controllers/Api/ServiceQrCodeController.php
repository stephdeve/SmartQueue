<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Service;
use App\Models\Ticket;
use App\Services\QrCodeService;
use App\Services\ServiceAvailabilityService;
use App\Services\TicketService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class ServiceQrCodeController extends Controller
{
    protected QrCodeService $qrService;
    protected TicketService $ticketService;

    public function __construct(QrCodeService $qrService, TicketService $ticketService)
    {
        $this->qrService = $qrService;
        $this->ticketService = $ticketService;
    }

    /**
     * Génère un QR code permanent pour un service.
     * Admin seulement.
     * 
     * POST /api/admin/services/{service}/qr-code
     */
    public function generate(Request $request, Service $service): JsonResponse
    {
        // Vérifier que l'utilisateur est admin de l'établissement
        $user = $request->user();
        if ($user->role !== 'admin' || $user->establishment_id !== $service->establishment_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $result = $this->qrService->generateForService($service);

        return response()->json([
            'message' => 'QR code généré avec succès',
            'qr_code' => [
                'token' => $result['token'],
                'url' => $result['url'],
                'content' => $result['content'],
                'generated_at' => $result['generated_at']->toIso8601String(),
                'service_name' => $service->name,
                'establishment_name' => $service->establishment?->name,
            ],
        ]);
    }

    /**
     * Récupère les infos du QR code d'un service.
     * 
     * GET /api/admin/services/{service}/qr-code
     */
    public function show(Request $request, Service $service): JsonResponse
    {
        $user = $request->user();
        if ($user->role !== 'admin' || $user->establishment_id !== $service->establishment_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $info = $this->qrService->getServiceQrInfo($service);

        if (!$info) {
            return response()->json([
                'message' => 'Aucun QR code généré pour ce service',
                'qr_code' => null,
            ]);
        }

        return response()->json([
            'qr_code' => $info,
        ]);
    }

    /**
     * Scanne un QR code et crée un ticket pour l'usager.
     * Endpoint public (authentification requise pour créer le ticket).
     * 
     * POST /api/qr-scan
     * Body: { "qr_content": "vqs://service/{uuid}" }
     */
    public function scan(Request $request): JsonResponse
    {
        $request->validate([
            'qr_content' => 'required|string',
        ]);

        $user = $request->user();
        if (!$user) {
            return response()->json([
                'message' => 'Authentification requise',
                'action' => 'login',
                'qr_content' => $request->qr_content, // Pour reprendre après login
            ], 401);
        }

        // Parser le contenu du QR code
        $token = $this->qrService->parseQrContent($request->qr_content);
        if (!$token) {
            return response()->json([
                'message' => 'QR code invalide',
            ], 400);
        }

        // Trouver le service
        $service = $this->qrService->findServiceByToken($token);
        if (!$service) {
            return response()->json([
                'message' => 'Service non trouvé',
            ], 404);
        }

        // La décision (active vs différée) est faite par SmartQueueEngine dans
        // TicketService::createForQrScan. Seul un service manuellement fermé est rejeté
        // en amont — sinon on laisse l'engine router automatiquement le ticket.
        if ($service->status !== 'open') {
            return response()->json([
                'message' => 'La file d\'attente est actuellement fermée',
                'service_name' => $service->name,
                'service_status' => $service->status,
            ], 400);
        }

        // Vérifier si l'usager a déjà un ticket actif pour ce service aujourd'hui
        $today = Carbon::today()->toDateString();
        $existingTicket = Ticket::where('service_id', $service->id)
            ->where('user_id', $user->id)
            ->where('valid_date', $today)
            ->whereIn('status', ['waiting', 'called'])
            ->first();

        if ($existingTicket) {
            // Retourner le ticket existant au lieu d'en créer un nouveau
            return response()->json([
                'message' => 'Vous avez déjà un ticket actif pour ce service',
                'ticket' => [
                    'id' => $existingTicket->id,
                    'number' => $existingTicket->number,
                    'position' => $existingTicket->position,
                    'status' => $existingTicket->status,
                    'service_name' => $service->name,
                    'created_at' => $existingTicket->created_at->toIso8601String(),
                ],
                'action' => 'show_existing',
            ]);
        }

        // Créer un nouveau ticket
        try {
            $ticket = $this->ticketService->createForQrScan($service, $user);
        } catch (\Exception $e) {
            \Log::error('QR scan ticket creation failed', [
                'service_id' => $service->id,
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'message' => 'Erreur lors de la création du ticket: ' . $e->getMessage(),
            ], 500);
        }

        return response()->json([
            'message' => 'Ticket créé avec succès',
            'ticket' => [
                'id' => $ticket->id,
                'number' => $ticket->number,
                'position' => $ticket->position,
                'status' => $ticket->status,
                'service_name' => $service->name,
                'establishment_name' => $service->establishment?->name,
                'estimated_wait_minutes' => $this->ticketService->estimateWaitTime($service, $ticket),
                'valid_date' => $ticket->valid_date,
                'created_at' => $ticket->created_at->toIso8601String(),
            ],
            'action' => 'created',
        ], 201);
    }

    /**
     * Télécharge le QR code en PNG.
     * 
     * GET /api/admin/services/{service}/qr-code/download
     */
    public function download(Request $request, Service $service)
    {
        $user = $request->user();
        if ($user->role !== 'admin' || $user->establishment_id !== $service->establishment_id) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        if (!$service->qr_code_url) {
            return response()->json(['message' => 'QR code non généré'], 404);
        }

        // Le QR code est stocké en base64 data URI
        $dataUrl = $service->qr_code_url;
        
        // Extraire le base64 du data URI
        if (!preg_match('/^data:image\/svg\+xml;base64,(.+)$/', $dataUrl, $matches)) {
            return response()->json(['message' => 'Format QR code invalide'], 400);
        }
        
        $base64 = $matches[1];
        $svgContent = base64_decode($base64);
        
        // Retourner le SVG directement - peut être imprimé depuis n'importe quel navigateur
        return response($svgContent)
            ->header('Content-Type', 'image/svg+xml')
            ->header('Content-Disposition', 'attachment; filename="qr-' . $service->name . '-' . $service->qr_code_token . '.svg"');
    }
}
