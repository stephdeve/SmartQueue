<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Firebase Cloud Messaging (FCM HTTP v1). Doit être lu ici afin que la valeur
    // soit disponible après `php artisan config:cache` (les appels env() directs
    // hors fichiers de config retournent null une fois la config mise en cache).
    'firebase' => [
        'service_account_json' => env('FIREBASE_SERVICE_ACCOUNT_JSON'),
    ],

    // Twilio (SMS). Lu via config() : env() renvoie null après `config:cache`.
    'twilio' => [
        'sid' => env('TWILIO_SID'),
        'token' => env('TWILIO_TOKEN'),
        'from' => env('TWILIO_FROM'),
    ],

    // Google Sign-In : identifiants OAuth (web, android, ios) acceptés comme audience
    // des ID tokens, séparés par des virgules.
    'google' => [
        'client_ids' => env('GOOGLE_CLIENT_IDS', ''),
    ],

];