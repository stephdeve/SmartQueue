<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Twilio\Rest\Client as TwilioClient;
use Illuminate\Support\Facades\Log;
use App\Models\NotificationLog;

class SendSmsNotification implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $phone, public string $message, public array $meta = []) {}

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $sid = env('TWILIO_SID');
        $token = env('TWILIO_TOKEN');
        $from = env('TWILIO_FROM');

        if (!$sid || !$token || !$from) {
            Log::warning('Twilio not configured; skipping SMS');
            NotificationLog::create([
                'ticket_id' => $this->meta['ticket_id'] ?? null,
                'channel' => 'sms',
                'type' => $this->meta['type'] ?? 'generic',
                'status' => 'failed',
                'payload' => ['to' => $this->phone, 'message' => $this->message],
                'sent_at' => null,
            ]);
            return;
        }

        try {
            $client = new TwilioClient($sid, $token);
            $client->messages->create($this->phone, [
                'from' => $from,
                'body' => $this->message,
            ]);
            NotificationLog::create([
                'ticket_id' => $this->meta['ticket_id'] ?? null,
                'channel' => 'sms',
                'type' => $this->meta['type'] ?? 'generic',
                'status' => 'sent',
                'payload' => ['to' => $this->phone, 'message' => $this->message],
                'sent_at' => now(),
            ]);
        } catch (\Throwable $e) {
            Log::error('Twilio SMS error: '.$e->getMessage());
            NotificationLog::create([
                'ticket_id' => $this->meta['ticket_id'] ?? null,
                'channel' => 'sms',
                'type' => $this->meta['type'] ?? 'generic',
                'status' => 'failed',
                'payload' => ['to' => $this->phone, 'message' => $this->message],
                'sent_at' => null,
            ]);
        }
    }
}
