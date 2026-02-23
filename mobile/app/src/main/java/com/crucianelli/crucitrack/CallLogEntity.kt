package com.crucianelli.crucitrack

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.google.gson.annotations.SerializedName

@Entity(tableName = "calls")
data class CallLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @SerializedName("numero_telefono") val phoneNumber: String,
    @SerializedName("tipo_llamada") val type: String,
    @SerializedName("duracion_segundos") val duration: Int,
    @SerializedName("dispositivo_id") val deviceId: String?,
    val timestamp: Long = System.currentTimeMillis(),
    val status: String = "FINALIZADA",
    val errorCloud: String? = null
)
