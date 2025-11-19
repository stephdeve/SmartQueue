/// <reference types="vite/client" />

// Ambient module declarations for packages without types
declare module 'laravel-echo' { const Echo: any; export default Echo }
declare module 'pusher-js' { const Pusher: any; export default Pusher }
