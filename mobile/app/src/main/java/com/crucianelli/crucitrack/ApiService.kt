package com.crucianelli.crucitrack

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.Headers
import retrofit2.http.POST

interface ApiService {
    @Headers("Prefer: return=minimal")
    @POST("llamadas")
    suspend fun uploadCall(
        @Header("apikey") apiKey: String,
        @Header("Authorization") bearer: String,
        @Body call: CallRequest
    ): Response<Unit>
}
