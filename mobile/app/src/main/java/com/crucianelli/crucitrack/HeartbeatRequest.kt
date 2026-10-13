package com.crucianelli.crucitrack

import com.google.gson.annotations.SerializedName

/** El servidor deduce la terminal del token y usa su propia hora como last_seen. */
data class HeartbeatRequest(
    @SerializedName("status") val status: String = "ONLINE"
)
