<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        // Ouvert aux utilisateurs non authentifiés
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
            // Nom requis
            'name' => ['required','string','max:120'],
            // Email unique
            'email' => ['required','email','max:190','unique:users,email'],
            // Mot de passe sécurisé
            'password' => ['required','string','min:8'],
            // Téléphone optionnel mais unique s'il est fourni
            'phone' => ['nullable','string','max:32','unique:users,phone'],
        ];
    }
}
