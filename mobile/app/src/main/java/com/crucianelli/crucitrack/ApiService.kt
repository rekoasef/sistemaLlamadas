package com.crucianelli.crucitrack

import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Url

interface ApiService {
    @POST
    suspend fun uploadCall(
        @Url url: String,
        @Header("apikey") apiKey: String,
        @Header("Authorization") bearer: String,
        @Body call: CallRequest
    )
}
