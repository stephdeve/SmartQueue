<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Review;
use App\Models\Ticket;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    /**
     * Avis publics pour un service.
     * GET /api/services/{service}/reviews
     */
    public function index(\App\Models\Service $service)
    {
        $reviews = Review::where('service_id', $service->id)
            ->with('user:id,name')
            ->latest()
            ->paginate(20);

        $avgRating = (float) Review::where('service_id', $service->id)->avg('rating');
        $total = Review::where('service_id', $service->id)->count();

        return response()->json([
            'reviews' => $reviews->items(),
            'avg_rating' => round($avgRating, 1),
            'total' => $total,
            'distribution' => [
                5 => Review::where('service_id', $service->id)->where('rating', 5)->count(),
                4 => Review::where('service_id', $service->id)->where('rating', 4)->count(),
                3 => Review::where('service_id', $service->id)->where('rating', 3)->count(),
                2 => Review::where('service_id', $service->id)->where('rating', 2)->count(),
                1 => Review::where('service_id', $service->id)->where('rating', 1)->count(),
            ],
            'has_more' => $reviews->hasMorePages(),
        ]);
    }

    /**
     * Soumettre une évaluation pour un ticket terminé.
     * POST /api/tickets/{ticket}/review
     */
    public function store(Request $request, Ticket $ticket)
    {
        $user = $request->user();

        // Seul le propriétaire du ticket peut l'évaluer (un ticket créé au guichet,
        // sans compte, ne peut pas être évalué par un tiers)
        if ((int) $ticket->user_id !== (int) $user->id) {
            abort(403, 'Accès refusé.');
        }

        // Le ticket doit avoir été servi
        if ($ticket->status !== 'closed') {
            return response()->json([
                'error' => 'Le ticket doit être terminé pour être évalué.',
            ], 422);
        }

        // Un seul avis par ticket
        if ($ticket->review()->exists()) {
            return response()->json([
                'error' => 'Ce ticket a déjà été évalué.',
            ], 409);
        }

        $validated = $request->validate([
            'rating'  => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string|max:500',
        ]);

        $review = Review::create([
            'ticket_id'  => $ticket->id,
            'service_id' => $ticket->service_id,
            'user_id'    => $user->id,
            'rating'     => $validated['rating'],
            'comment'    => $validated['comment'] ?? null,
        ]);

        return response()->json(['success' => true, 'review' => $review]);
    }
}
