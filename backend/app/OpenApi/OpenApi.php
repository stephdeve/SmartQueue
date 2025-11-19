<?php

namespace App\OpenApi;

/**
 * @OA\Info(
 *   title="Smart Queue API",
 *   version="1.0.0",
 *   description="API de gestion intelligente des files d’attente (Laravel 11)."
 * )
 *
 * @OA\Server(
 *   url="http://localhost",
 *   description="Local"
 * )
 *
 * @OA\SecurityScheme(
 *   securityScheme="sanctum",
 *   type="http",
 *   scheme="bearer",
 *   bearerFormat="Token"
 * )
 *
 * @OA\Schema(
 *   schema="Error",
 *   type="object",
 *   @OA\Property(property="error", type="object",
 *     @OA\Property(property="code", type="string"),
 *     @OA\Property(property="message", type="string"),
 *     @OA\Property(property="details", type="object", nullable=true)
 *   )
 * )
 *
 * @OA\Schema(
 *   schema="PaginationLinks",
 *   type="object",
 *   additionalProperties=true
 * )
 *
 * @OA\Schema(
 *   schema="PaginationMeta",
 *   type="object",
 *   additionalProperties=true
 * )
 *
 * @OA\Schema(
 *   schema="Establishment",
 *   type="object",
 *   required={"id","name"},
 *   @OA\Property(property="id", type="integer"),
 *   @OA\Property(property="name", type="string"),
 *   @OA\Property(property="address", type="string", nullable=true),
 *   @OA\Property(property="lat", type="number", format="float", nullable=true),
 *   @OA\Property(property="lng", type="number", format="float", nullable=true),
 *   @OA\Property(property="open_at", type="string", nullable=true),
 *   @OA\Property(property="close_at", type="string", nullable=true),
 *   @OA\Property(property="is_active", type="boolean"),
 *   @OA\Property(property="distance_m", type="integer", nullable=true)
 * )
 *
 * @OA\Schema(
 *   schema="Service",
 *   type="object",
 *   required={"id","name","status"},
 *   @OA\Property(property="id", type="integer"),
 *   @OA\Property(property="name", type="string"),
 *   @OA\Property(property="status", type="string", enum={"open","closed"}),
 *   @OA\Property(property="avg_service_time_minutes", type="integer"),
 *   @OA\Property(property="people_waiting", type="integer", nullable=true),
 *   @OA\Property(property="establishment", type="object", nullable=true,
 *     @OA\Property(property="id", type="integer"),
 *     @OA\Property(property="name", type="string")
 *   )
 * )
 *
 * @OA\Schema(
 *   schema="Ticket",
 *   type="object",
 *   required={"id","number","status","priority","service","establishment"},
 *   @OA\Property(property="id", type="integer"),
 *   @OA\Property(property="number", type="string"),
 *   @OA\Property(property="status", type="string", enum={"waiting","called","absent","closed","canceled"}),
 *   @OA\Property(property="priority", type="string", enum={"normal","high","vip"}),
 *   @OA\Property(property="position", type="integer", nullable=true),
 *   @OA\Property(property="eta_minutes", type="integer", nullable=true),
 *   @OA\Property(property="called_at", type="string", format="date-time", nullable=true),
 *   @OA\Property(property="service", ref="#/components/schemas/Service"),
 *   @OA\Property(property="establishment", type="object",
 *     @OA\Property(property="id", type="integer"),
 *     @OA\Property(property="name", type="string")
 *   )
 * )
 *
 * @OA\Schema(
 *   schema="Affluence",
 *   type="object",
 *   required={"level","people","eta_avg"},
 *   @OA\Property(property="level", type="string", enum={"low","medium","high"}),
 *   @OA\Property(property="people", type="integer"),
 *   @OA\Property(property="eta_avg", type="integer")
 * )
 *
 * @OA\Schema(
 *   schema="AuthTokenResponse",
 *   type="object",
 *   @OA\Property(property="user", type="object",
 *     @OA\Property(property="id", type="integer"),
 *     @OA\Property(property="name", type="string"),
 *     @OA\Property(property="email", type="string"),
 *     @OA\Property(property="phone", type="string", nullable=true),
 *     @OA\Property(property="role", type="string")
 *   ),
 *   @OA\Property(property="token", type="string")
 * )
 *
 * @OA\Tag(name="Auth")
 * @OA\Tag(name="Establishments")
 * @OA\Tag(name="Services")
 * @OA\Tag(name="Tickets")
 * @OA\Tag(name="Agent")
 * @OA\Tag(name="Admin")
 */
class OpenApi {}

/**
 * @OA\Post(
 *   path="/api/auth/register",
 *   tags={"Auth"},
 *   @OA\RequestBody(required=true, @OA\JsonContent(
 *     required={"name","email","password"},
 *     @OA\Property(property="name", type="string"),
 *     @OA\Property(property="email", type="string"),
 *     @OA\Property(property="password", type="string"),
 *     @OA\Property(property="phone", type="string")
 *   )),
 *   @OA\Response(response=201, description="Created", @OA\JsonContent(ref="#/components/schemas/AuthTokenResponse", example={
 *     "user": {"id": 1, "name": "Alice", "email": "alice@example.com", "phone": "+221770000000", "role": "user"},
 *     "token": "eyJ0eXAiOiJKV1Qi..."
 *   })),
 *   @OA\Response(response=422, description="Validation error", @OA\JsonContent(ref="#/components/schemas/Error"))
 * )
 *
 * @OA\Post(
 *   path="/api/auth/login",
 *   tags={"Auth"},
 *   @OA\RequestBody(required=true, @OA\JsonContent(
 *     required={"email","password"},
 *     @OA\Property(property="email", type="string"),
 *     @OA\Property(property="password", type="string")
 *   )),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(ref="#/components/schemas/AuthTokenResponse", example={
 *     "user": {"id": 1, "name": "Alice", "email": "alice@example.com", "phone": "+221770000000", "role": "user"},
 *     "token": "eyJ0eXAiOiJKV1Qi..."
 *   })),
 *   @OA\Response(response=401, description="Unauthorized", @OA\JsonContent(ref="#/components/schemas/Error"))
 * )
 *
 * @OA\Post(
 *   path="/api/auth/logout",
 *   security={{"sanctum":{}}},
 *   tags={"Auth"},
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(type="object", example={"message":"Logged out"}))
 * )
 *
 * @OA\Post(
 *   path="/api/auth/devices/register",
 *   security={{"sanctum":{}}},
 *   tags={"Auth"},
 *   @OA\RequestBody(required=true, @OA\JsonContent(
 *     required={"fcm_token"},
 *     @OA\Property(property="fcm_token", type="string"),
 *     @OA\Property(property="platform", type="string", enum={"android","ios","web"}),
 *     @OA\Property(property="app_version", type="string"),
 *     @OA\Property(property="push_enabled", type="boolean"),
 *     @OA\Property(property="sms_enabled", type="boolean")
 *   )),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(example={"message":"Device registered","device_id":42}))
 * )
 */
class OpenApiAuth {}

/**
 * @OA\Get(
 *   path="/api/establishments",
 *   tags={"Establishments"},
 *   @OA\Parameter(name="lat", in="query", @OA\Schema(type="number")),
 *   @OA\Parameter(name="lng", in="query", @OA\Schema(type="number")),
 *   @OA\Parameter(name="radius", in="query", @OA\Schema(type="integer")),
 *   @OA\Parameter(name="per_page", in="query", @OA\Schema(type="integer")),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(
 *     type="object",
 *     @OA\Property(property="data", type="array", @OA\Items(ref="#/components/schemas/Establishment")),
 *     @OA\Property(property="links", ref="#/components/schemas/PaginationLinks"),
 *     @OA\Property(property="meta", ref="#/components/schemas/PaginationMeta"),
 *     example={
 *       "data": {{"id":5,"name":"Hôpital Central","address":"Av. de la République","lat":14.7167,"lng":-17.4677,"open_at":"08:00:00","close_at":"17:00:00","is_active":true,"distance_m":350}},
 *       "links": {"first":"http://localhost/api/establishments?page=1","last":"http://localhost/api/establishments?page=1","prev":null,"next":null},
 *       "meta": {"current_page":1,"per_page":20,"total":1}
 *     }
 *   ))
 * )
 *
 * @OA\Get(
 *   path="/api/establishments/search",
 *   tags={"Establishments"},
 *   @OA\Parameter(name="q", in="query", @OA\Schema(type="string")),
 *   @OA\Parameter(name="per_page", in="query", @OA\Schema(type="integer")),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(type="object", example={
 *     "data": {{"id":5,"name":"Hôpital Central","address":"Av. ...","lat":14.7167,"lng":-17.4677,"open_at":"08:00:00","close_at":"17:00:00","is_active":true}},
 *     "links": {"first":"http://localhost/api/establishments/search?page=1","last":"http://localhost/api/establishments/search?page=1","prev":null,"next":null},
 *     "meta": {"current_page":1,"per_page":20,"total":1}
 *   }))
 * )
 *
 * @OA\Get(
 *   path="/api/establishments/{id}",
 *   tags={"Establishments"},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(ref="#/components/schemas/Establishment", example={
 *     "id":5,"name":"Hôpital Central","address":"Av. ...","lat":14.7167,"lng":-17.4677,
 *     "open_at":"08:00:00","close_at":"17:00:00","is_active":true
 *   })),
 *   @OA\Response(response=404, description="Not found", @OA\JsonContent(ref="#/components/schemas/Error"))
 * )
 */
class OpenApiEstablishments {}

/**
 * @OA\Get(
 *   path="/api/establishments/{id}/services",
 *   tags={"Services"},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
 *   @OA\Parameter(name="status", in="query", @OA\Schema(type="string", enum={"open","closed"})),
 *   @OA\Parameter(name="priority_support", in="query", @OA\Schema(type="boolean")),
 *   @OA\Parameter(name="people_waiting_min", in="query", @OA\Schema(type="integer")),
 *   @OA\Parameter(name="people_waiting_max", in="query", @OA\Schema(type="integer")),
 *   @OA\Parameter(name="per_page", in="query", @OA\Schema(type="integer")),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(type="object", example={
 *     "data": {{"id":123,"name":"Consultation","status":"open","avg_service_time_minutes":5,"people_waiting":3,
 *       "establishment": {"id":5,"name":"Hôpital Central"}}},
 *     "links": {"first":"http://localhost/api/establishments/5/services?page=1","last":"http://localhost/api/establishments/5/services?page=1","prev":null,"next":null},
 *     "meta": {"current_page":1,"per_page":20,"total":1}
 *   }))
 * )
 *
 * @OA\Get(
 *   path="/api/services/{id}",
 *   tags={"Services"},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(ref="#/components/schemas/Service", example={
 *     "id":123,"name":"Consultation","status":"open","avg_service_time_minutes":5,
 *     "people_waiting":3,
 *     "establishment": {"id":5,"name":"Hôpital Central"}
 *   }))
 * )
 *
 * @OA\Get(
 *   path="/api/services/{id}/affluence",
 *   tags={"Services"},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(ref="#/components/schemas/Affluence", example={
 *     "level":"medium","people":6,"eta_avg":12
 *   }))
 * )
 *
 * @OA\Get(
 *   path="/api/services/{id}/recommendations",
 *   tags={"Services"},
 *   @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(type="array", @OA\Items(type="object"), example={{
 *     "start":"08:00","end":"09:00","reason":"Faible affluence historique"
 *   }}))
 * )
 */
class OpenApiServices {}

/**
 * @OA\Post(
 *   path="/api/tickets",
 *   security={{"sanctum":{}}},
 *   tags={"Tickets"},
 *   @OA\RequestBody(required=true, @OA\JsonContent(
 *     required={"service_id"},
 *     @OA\Property(property="service_id", type="integer"),
 *     @OA\Property(property="lat", type="number"),
 *     @OA\Property(property="lng", type="number"),
 *     @OA\Property(property="from_qr", type="string")
 *   )),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(ref="#/components/schemas/Ticket", example={
 *     "id":987,"number":"C-012-20251117","status":"waiting","priority":"normal","position":12,
 *     "eta_minutes":60,"called_at":null,
 *     "service": {"id":123,"name":"Consultation","status":"open","avg_service_time_minutes":5},
 *     "establishment": {"id":5,"name":"Hôpital Central"}
 *   })),
 *   @OA\Response(response=422, description="Validation error", @OA\JsonContent(ref="#/components/schemas/Error"))
 * )
 *
 * @OA\Get(
 *   path="/api/tickets/active",
 *   security={{"sanctum":{}}},
 *   tags={"Tickets"},
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(type="array", @OA\Items(ref="#/components/schemas/Ticket"), example={
 *     {"id":987,"number":"C-012-20251117","status":"waiting","priority":"normal","position":12,
 *       "eta_minutes":60,"called_at":null,
 *       "service": {"id":123,"name":"Consultation","status":"open","avg_service_time_minutes":5},
 *       "establishment": {"id":5,"name":"Hôpital Central"}
 *     }
 *   }))
 * )
 *
 * @OA\Get(
 *   path="/api/tickets/history",
 *   security={{"sanctum":{}}},
 *   tags={"Tickets"},
 *   @OA\Parameter(name="status", in="query", @OA\Schema(type="string", enum={"closed","canceled"})),
 *   @OA\Parameter(name="from", in="query", @OA\Schema(type="string", format="date")),
 *   @OA\Parameter(name="to", in="query", @OA\Schema(type="string", format="date")),
 *   @OA\Parameter(name="per_page", in="query", @OA\Schema(type="integer")),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(type="object", example={
 *     "data": {{"id":654,"number":"A-101-20251117","status":"closed","priority":"normal","position":null,
 *       "eta_minutes":null,"called_at":"2025-11-17T13:15:00Z",
 *       "service": {"id":123,"name":"Consultation","status":"open","avg_service_time_minutes":5},
 *       "establishment": {"id":5,"name":"Hôpital Central"}}},
 *     "links": {"first":"http://localhost/api/tickets/history?page=1","last":"http://localhost/api/tickets/history?page=5","prev":null,"next":"http://localhost/api/tickets/history?page=2"},
 *     "meta": {"current_page":1,"per_page":20,"total":96}
 *   }))
 * )
 *
 * @OA\Get(
 *   path="/api/tickets/{ticket}",
 *   security={{"sanctum":{}}},
 *   tags={"Tickets"},
 *   @OA\Parameter(name="ticket", in="path", required=true, @OA\Schema(type="integer")),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(ref="#/components/schemas/Ticket", example={
 *     "id":987,"number":"C-012-20251117","status":"waiting","priority":"normal","position":12,
 *     "eta_minutes":60,"called_at":null,
 *     "service": {"id":123,"name":"Consultation","status":"open","avg_service_time_minutes":5},
 *     "establishment": {"id":5,"name":"Hôpital Central"}
 *   })),
 *   @OA\Response(response=403, description="Forbidden", @OA\JsonContent(ref="#/components/schemas/Error")),
 *   @OA\Response(response=404, description="Not found", @OA\JsonContent(ref="#/components/schemas/Error"))
 * )
 *
 * @OA\Patch(
 *   path="/api/tickets/{ticket}",
 *   security={{"sanctum":{}}},
 *   tags={"Tickets"},
 *   @OA\Parameter(name="ticket", in="path", required=true, @OA\Schema(type="integer")),
 *   @OA\RequestBody(required=true, @OA\JsonContent(
 *     required={"action"}, @OA\Property(property="action", type="string", enum={"cancel"})
 *   )),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(ref="#/components/schemas/Ticket", example={
 *     "id":987,"number":"C-012-20251117","status":"canceled","priority":"normal","position":null,
 *     "eta_minutes":null,"called_at":null,
 *     "service": {"id":123,"name":"Consultation","status":"open","avg_service_time_minutes":5},
 *     "establishment": {"id":5,"name":"Hôpital Central"}
 *   }))
 * )
 */
class OpenApiTickets {}

/**
 * @OA\Post(path="/api/services/{service}/call-next", security={{"sanctum":{}}}, tags={"Agent"},
 *   @OA\Parameter(name="service", in="path", required=true, @OA\Schema(type="integer")),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(example={"called_ticket": {"id":987,"number":"C-012-20251117","status":"called"}})),
 *   @OA\Response(response=204, description="No eligible ticket"),
 *   @OA\Response(response=403, description="Forbidden", @OA\JsonContent(ref="#/components/schemas/Error"))
 * )
 * @OA\Post(path="/api/tickets/{ticket}/mark-absent", security={{"sanctum":{}}}, tags={"Agent"},
 *   @OA\Parameter(name="ticket", in="path", required=true, @OA\Schema(type="integer")),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(example={"ticket": {"id":987,"status":"absent"}})))
 * @OA\Post(path="/api/tickets/{ticket}/recall", security={{"sanctum":{}}}, tags={"Agent"},
 *   @OA\Parameter(name="ticket", in="path", required=true, @OA\Schema(type="integer")),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(example={"ticket": {"id":987,"status":"called"}})))
 * @OA\Post(path="/api/services/{service}/close", security={{"sanctum":{}}}, tags={"Agent"},
 *   @OA\Parameter(name="service", in="path", required=true, @OA\Schema(type="integer")),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(example={"message":"Service closed","service_id":123})))
 */
class OpenApiAgent {}

/**
 * @OA\Get(path="/api/admin/establishments", security={{"sanctum":{}}}, tags={"Admin"}, @OA\Response(response=200, description="OK", @OA\JsonContent(type="object", example={
 *   "data": {{"id":5,"name":"Hôpital Central","address":"Av. ...","lat":14.7167,"lng":-17.4677,"open_at":"08:00:00","close_at":"17:00:00","is_active":true}},
 *   "links": {"first":"http://localhost/api/admin/establishments?page=1","last":"http://localhost/api/admin/establishments?page=1","prev":null,"next":null},
 *   "meta": {"current_page":1,"per_page":50,"total":1}
 * })))
 * @OA\Post(path="/api/admin/establishments", security={{"sanctum":{}}}, tags={"Admin"},
 *   @OA\RequestBody(required=true, @OA\JsonContent(
 *     required={"name"},
 *     @OA\Property(property="name", type="string"),
 *     @OA\Property(property="address", type="string"),
 *     @OA\Property(property="lat", type="number"),
 *     @OA\Property(property="lng", type="number"),
 *     @OA\Property(property="open_at", type="string"),
 *     @OA\Property(property="close_at", type="string"),
 *     @OA\Property(property="is_active", type="boolean"),
 *     example={"name":"Clinique Diamniadio","address":"Zone A","lat":14.7,"lng":-17.45,"open_at":"08:00:00","close_at":"17:00:00","is_active":true}
 *   )),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(ref="#/components/schemas/Establishment", example={
 *   "id":6,"name":"Clinique Diamniadio","address":"Zone A","lat":14.7,"lng":-17.45,"open_at":"08:00:00","close_at":"17:00:00","is_active":true
 * })))
 * @OA\Get(path="/api/admin/establishments/{id}", security={{"sanctum":{}}}, tags={"Admin"}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")), @OA\Response(response=200, description="OK", @OA\JsonContent(ref="#/components/schemas/Establishment", example={
 *   "id":5,"name":"Hôpital Central","address":"Av. ...","lat":14.7167,"lng":-17.4677,"open_at":"08:00:00","close_at":"17:00:00","is_active":true
 * })))
 * @OA\Put(path="/api/admin/establishments/{id}", security={{"sanctum":{}}}, tags={"Admin"}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
 *   @OA\RequestBody(required=true, @OA\JsonContent(
 *     @OA\Property(property="name", type="string"),
 *     @OA\Property(property="address", type="string"),
 *     @OA\Property(property="lat", type="number"),
 *     @OA\Property(property="lng", type="number"),
 *     @OA\Property(property="open_at", type="string"),
 *     @OA\Property(property="close_at", type="string"),
 *     @OA\Property(property="is_active", type="boolean"),
 *     example={"name":"Hôpital Central (Maj)","is_active":true}
 *   )),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(ref="#/components/schemas/Establishment", example={
 *   "id":5,"name":"Hôpital Central (Maj)","address":"Av. ...","lat":14.7167,"lng":-17.4677,"open_at":"08:00:00","close_at":"17:00:00","is_active":true
 * })))
 * @OA\Delete(path="/api/admin/establishments/{id}", security={{"sanctum":{}}}, tags={"Admin"}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")), @OA\Response(response=200, description="OK", @OA\JsonContent(example={"message":"Deleted"})))
 *
 * @OA\Get(path="/api/admin/services", security={{"sanctum":{}}}, tags={"Admin"}, @OA\Response(response=200, description="OK", @OA\JsonContent(type="object", example={
 *   "data": {{"id":123,"name":"Consultation","status":"open","avg_service_time_minutes":5,"priority_support":false,
 *     "establishment": {"id":5,"name":"Hôpital Central"}}},
 *   "links": {"first":"http://localhost/api/admin/services?page=1","last":"http://localhost/api/admin/services?page=1","prev":null,"next":null},
 *   "meta": {"current_page":1,"per_page":50,"total":1}
 * })))
 * @OA\Post(path="/api/admin/services", security={{"sanctum":{}}}, tags={"Admin"},
 *   @OA\RequestBody(required=true, @OA\JsonContent(
 *     required={"establishment_id","name"},
 *     @OA\Property(property="establishment_id", type="integer"),
 *     @OA\Property(property="name", type="string"),
 *     @OA\Property(property="avg_service_time_minutes", type="integer"),
 *     @OA\Property(property="status", type="string", enum={"open","closed"}),
 *     @OA\Property(property="priority_support", type="boolean"),
 *     example={"establishment_id":5,"name":"Vaccination","avg_service_time_minutes":7,"status":"open","priority_support":true}
 *   )),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(ref="#/components/schemas/Service", example={
 *   "id":124,"name":"Vaccination","status":"open","avg_service_time_minutes":7,"priority_support":true,
 *   "establishment": {"id":5,"name":"Hôpital Central"}
 * })))
 * @OA\Get(path="/api/admin/services/{id}", security={{"sanctum":{}}}, tags={"Admin"}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")), @OA\Response(response=200, description="OK", @OA\JsonContent(ref="#/components/schemas/Service", example={
 *   "id":123,"name":"Consultation","status":"open","avg_service_time_minutes":5,"priority_support":false,
 *   "establishment": {"id":5,"name":"Hôpital Central"}
 * })))
 * @OA\Put(path="/api/admin/services/{id}", security={{"sanctum":{}}}, tags={"Admin"}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
 *   @OA\RequestBody(required=true, @OA\JsonContent(
 *     @OA\Property(property="establishment_id", type="integer"),
 *     @OA\Property(property="name", type="string"),
 *     @OA\Property(property="avg_service_time_minutes", type="integer"),
 *     @OA\Property(property="status", type="string", enum={"open","closed"}),
 *     @OA\Property(property="priority_support", type="boolean"),
 *     example={"name":"Consultation (Maj)","avg_service_time_minutes":6}
 *   )),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(ref="#/components/schemas/Service", example={
 *   "id":123,"name":"Consultation (Maj)","status":"open","avg_service_time_minutes":6,"priority_support":false,
 *   "establishment": {"id":5,"name":"Hôpital Central"}
 * })))
 * @OA\Delete(path="/api/admin/services/{id}", security={{"sanctum":{}}}, tags={"Admin"}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")), @OA\Response(response=200, description="OK", @OA\JsonContent(example={"message":"Deleted"})))
 *
 * @OA\Get(path="/api/admin/agents", security={{"sanctum":{}}}, tags={"Admin"}, @OA\Response(response=200, description="OK", @OA\JsonContent(type="object", example={
 *   "data": {{"id":9,"name":"Agent Bob","email":"bob@example.com","phone":"+221770000001","role":"agent",
 *     "services": {{"id":123,"name":"Consultation"}}}},
 *   "links": {"first":"http://localhost/api/admin/agents?page=1","last":"http://localhost/api/admin/agents?page=1","prev":null,"next":null},
 *   "meta": {"current_page":1,"per_page":50,"total":1}
 * })))
 * @OA\Post(path="/api/admin/agents", security={{"sanctum":{}}}, tags={"Admin"},
 *   @OA\RequestBody(required=true, @OA\JsonContent(
 *     required={"name","email","password"},
 *     @OA\Property(property="name", type="string"),
 *     @OA\Property(property="email", type="string"),
 *     @OA\Property(property="password", type="string"),
 *     @OA\Property(property="phone", type="string"),
 *     @OA\Property(property="service_ids", type="array", @OA\Items(type="integer")),
 *     example={"name":"Agent Alice","email":"agent.alice@example.com","password":"secret1234","phone":"+221770000002","service_ids":{123,124}}
 *   )),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(example={
 *   "id":10,"name":"Agent Alice","email":"agent.alice@example.com","phone":"+221770000002","role":"agent",
 *   "services": {{"id":123,"name":"Consultation"},{"id":124,"name":"Vaccination"}}
 * })))
 * @OA\Get(path="/api/admin/agents/{id}", security={{"sanctum":{}}}, tags={"Admin"}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")), @OA\Response(response=200, description="OK", @OA\JsonContent(example={
 *   "id":9,"name":"Agent Bob","email":"bob@example.com","phone":"+221770000001","role":"agent",
 *   "services": {{"id":123,"name":"Consultation"}}
 * })))
 * @OA\Put(path="/api/admin/agents/{id}", security={{"sanctum":{}}}, tags={"Admin"}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")),
 *   @OA\RequestBody(required=true, @OA\JsonContent(
 *     @OA\Property(property="name", type="string"),
 *     @OA\Property(property="email", type="string"),
 *     @OA\Property(property="password", type="string"),
 *     @OA\Property(property="phone", type="string"),
 *     @OA\Property(property="service_ids", type="array", @OA\Items(type="integer")),
 *     example={"name":"Agent Bob (Maj)","service_ids":{123}}
 *   )),
 *   @OA\Response(response=200, description="OK", @OA\JsonContent(example={
 *   "id":9,"name":"Agent Bob (Maj)","email":"bob@example.com","phone":"+221770000001","role":"agent",
 *   "services": {{"id":123,"name":"Consultation"}}
 * })))
 * @OA\Delete(path="/api/admin/agents/{id}", security={{"sanctum":{}}}, tags={"Admin"}, @OA\Parameter(name="id", in="path", required=true, @OA\Schema(type="integer")), @OA\Response(response=200, description="OK", @OA\JsonContent(example={"message":"Deleted"})))
 *
 * @OA\Get(path="/api/admin/stats/overview", security={{"sanctum":{}}}, tags={"Admin"}, @OA\Response(response=200, description="OK",
 *   @OA\JsonContent(example={
 *     "from":"2025-11-10 00:00:00","to":"2025-11-17 23:59:59",
 *     "tickets": {"created":120,"closed":100,"absent":8,"wait_avg_minutes":14}
 *   })
 * ))
 * @OA\Get(path="/api/admin/stats/services/{serviceId}", security={{"sanctum":{}}}, tags={"Admin"}, @OA\Parameter(name="serviceId", in="path", required=true, @OA\Schema(type="integer")), @OA\Response(response=200, description="OK",
 *   @OA\JsonContent(example={
 *     "service_id":123,
 *     "from":"2025-11-10 00:00:00","to":"2025-11-17 23:59:59",
 *     "tickets": {"created":30,"closed":28,"absent":2,"service_time_avg_minutes":6}
 *   })
 * ))
 */
class OpenApiAdmin {}
