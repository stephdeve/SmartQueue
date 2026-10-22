<?php

/*
| Messages de validation en français (les clients affichent `message`, qui reprend
| la première erreur). Seules les règles utilisées par l'API sont traduites ;
| les autres retombent sur l'anglais (fallback_locale).
*/

return [
    'accepted' => 'Le champ :attribute doit être accepté.',
    'array' => 'Le champ :attribute doit être une liste.',
    'between' => [
        'numeric' => 'Le champ :attribute doit être compris entre :min et :max.',
        'string' => 'Le champ :attribute doit contenir entre :min et :max caractères.',
        'array' => 'Le champ :attribute doit contenir entre :min et :max éléments.',
        'file' => 'Le fichier :attribute doit peser entre :min et :max Ko.',
    ],
    'boolean' => 'Le champ :attribute doit être vrai ou faux.',
    'confirmed' => 'La confirmation du champ :attribute ne correspond pas.',
    'date' => "Le champ :attribute n'est pas une date valide.",
    'date_format' => 'Le champ :attribute doit respecter le format :format.',
    'email' => 'Le champ :attribute doit être une adresse e-mail valide.',
    'exists' => 'La valeur du champ :attribute est invalide.',
    'file' => 'Le champ :attribute doit être un fichier.',
    'image' => 'Le champ :attribute doit être une image.',
    'in' => 'La valeur du champ :attribute est invalide.',
    'integer' => 'Le champ :attribute doit être un nombre entier.',
    'max' => [
        'numeric' => 'Le champ :attribute ne peut pas dépasser :max.',
        'string' => 'Le champ :attribute ne peut pas dépasser :max caractères.',
        'array' => 'Le champ :attribute ne peut pas contenir plus de :max éléments.',
        'file' => 'Le fichier :attribute ne peut pas dépasser :max Ko.',
    ],
    'mimes' => 'Le fichier :attribute doit être de type : :values.',
    'mimetypes' => 'Le fichier :attribute doit être de type : :values.',
    'min' => [
        'numeric' => 'Le champ :attribute doit être au moins égal à :min.',
        'string' => 'Le champ :attribute doit contenir au moins :min caractères.',
        'array' => 'Le champ :attribute doit contenir au moins :min éléments.',
        'file' => 'Le fichier :attribute doit peser au moins :min Ko.',
    ],
    'numeric' => 'Le champ :attribute doit être un nombre.',
    'regex' => "Le format du champ :attribute n'est pas valide.",
    'required' => 'Le champ :attribute est obligatoire.',
    'required_with' => 'Le champ :attribute est obligatoire quand :values est renseigné.',
    'required_without' => "Le champ :attribute est obligatoire quand :values n'est pas renseigné.",
    'same' => 'Les champs :attribute et :other doivent correspondre.',
    'string' => 'Le champ :attribute doit être une chaîne de caractères.',
    'unique' => 'Cette valeur de :attribute est déjà utilisée.',
    'url' => 'Le champ :attribute doit être une URL valide.',
    'password' => [
        'letters' => 'Le champ :attribute doit contenir au moins une lettre.',
        'mixed' => 'Le champ :attribute doit contenir au moins une majuscule et une minuscule.',
        'numbers' => 'Le champ :attribute doit contenir au moins un chiffre.',
        'symbols' => 'Le champ :attribute doit contenir au moins un symbole.',
        'uncompromised' => 'Ce :attribute est apparu dans une fuite de données. Choisissez-en un autre.',
    ],

    'attributes' => [
        'name' => 'nom',
        'email' => 'adresse e-mail',
        'admin_email' => 'adresse e-mail',
        'password' => 'mot de passe',
        'current_password' => 'mot de passe actuel',
        'phone' => 'téléphone',
        'admin_phone' => 'téléphone',
        'address' => 'adresse',
        'lat' => 'latitude',
        'lng' => 'longitude',
        'open_at' => "heure d'ouverture",
        'close_at' => 'heure de fermeture',
        'plan' => 'offre',
        'status' => 'statut',
        'service_id' => 'service',
        'service_ids' => 'services',
        'capacity' => 'capacité',
        'rating' => 'note',
        'comment' => 'commentaire',
        'token' => 'jeton',
        'customer_name' => 'nom du client',
        'customer_phone' => 'téléphone du client',
        'establishment_name' => "nom de l'établissement",
    ],
];
