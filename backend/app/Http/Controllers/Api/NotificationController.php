<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Http\Response;

class NotificationController extends Controller
{
    // GET /api/notifications?per_page=50
    public function index(Request $req)
    {
        $perPage = (int) $req->query('per_page', 50);
        $perPage = max(1, min($perPage, 100)); // bornes simples 1..100

        $items = $req->user()
            ->notifications()          // Relation du trait Notifiable
            ->latest()
            ->limit($perPage)
            ->get();

        return response()->json([
            'data' => $items,
        ]);
    }

    // POST /api/notifications/{id}/read
    public function read(Request $req, $id)
    {
        $n = $req->user()->notifications()->findOrFail($id);
        if (!$n->read_at) {
            $n->markAsRead(); // définit read_at = now()
        }
        return response()->noContent();
    }

    // DELETE /api/notifications/{id}
    public function destroy(Request $req, $id)
    {
        $n = $req->user()->notifications()->findOrFail($id);
        $n->delete();
        return response()->noContent();
    }
}
