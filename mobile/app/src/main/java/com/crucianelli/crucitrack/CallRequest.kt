package com.crucianelli.crucitrack

import com.google.gson.annotations.SerializedName

/**
 * Llamada que se manda a /api/ingest/llamada.
 * El dispositivo no viaja: el servidor lo deduce del token.
 */
data class CallRequest(
    /** UUID generado al detectar la llamada: un reintento no la duplica. */
    @SerializedName("id")
    val id: String,

    @SerializedName("numero_telefono")
    val phoneNumber: String,

    @SerializedName("tipo_llamada")
    val type: String,

    @SerializedName("duracion_segundos")
    val duration: Int,

    @SerializedName("estado")
    val status: String,

    /** Hora de la llamada según el CallLog, ISO 8601 con offset. */
    @SerializedName("fecha_llamada")
    val date: String
)
