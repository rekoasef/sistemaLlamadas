package com.crucianelli.crucitrack

import com.google.gson.annotations.SerializedName
import java.text.SimpleDateFormat
import java.util.*

data class CallRequest(
    @SerializedName("numero_telefono") val phoneNumber: String,
    @SerializedName("tipo_llamada") val type: String,
    @SerializedName("duracion_segundos") val duration: Int,
    @SerializedName("dispositivo_id") val deviceId: String?,
    @SerializedName("estado") val status: String,
    @SerializedName("fecha_llamada") val callDate: String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).format(Date())
)
