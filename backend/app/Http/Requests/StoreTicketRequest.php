<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreTicketRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // Réservé aux utilisateurs authentifiés (contrôlé par middleware)
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            // Service cible obligatoire
            'service_id' => ['required','integer','exists:services,id'],
            // Coordonnées optionnelles (améliorent l'algorithme d'appel)
            'lat' => ['nullable','numeric','between:-90,90'],
            'lng' => ['nullable','numeric','between:-180,180'],
            // Indicateur QR (si le ticket provient d'un scan sur place)
            'from_qr' => ['nullable','string','max:64'],
        ];
    }
}
