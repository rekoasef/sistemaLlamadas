package com.crucianelli.crucitrack

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

/** Endpoints de ingesta de la web (Next.js). Autentican con el token del dispositivo. */
interface ApiService {
    @POST("api/ingest/llamada")
    suspend fun uploadCall(
        @Header("Authorization") bearer: String,
        @Body call: CallRequest
    ): Response<Unit>

    @POST("api/ingest/heartbeat")
    suspend fun sendHeartbeat(
        @Header("Authorization") bearer: String,
        @Body heartbeat: HeartbeatRequest
    ): Response<Unit>
}
