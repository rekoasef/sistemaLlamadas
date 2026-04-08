package com.crucianelli.crucitrack

import com.google.gson.annotations.SerializedName
import java.text.SimpleDateFormat
import java.util.*

data class HeartbeatRequest(
    @SerializedName("terminal_id") val terminalId: String,
    @SerializedName("status")      val status: String = "ONLINE",
    @SerializedName("last_seen")   val lastSeen: String =
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSXXX", Locale.getDefault()).format(Date())
)
