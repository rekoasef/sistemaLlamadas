package com.crucianelli.crucitrack

import android.content.Context

/**
 * ID del puesto y token de la terminal, cargados a mano en el diálogo "ID".
 *
 * El token lo genera la web (Dispositivos → Generar token) y es lo que autoriza
 * a este teléfono a mandar llamadas y heartbeats. El servidor deduce el ID del
 * puesto a partir del token; el ID local se usa solo para mostrarlo.
 */
object DeviceSettings {
    private const val PREFS = "Config"
    private const val KEY_DEVICE_ID = "device_id"
    private const val KEY_TOKEN = "token"

    fun deviceId(context: Context): String? =
        prefs(context).getString(KEY_DEVICE_ID, null)?.takeIf { it.isNotBlank() }

    fun token(context: Context): String? =
        prefs(context).getString(KEY_TOKEN, null)?.takeIf { it.isNotBlank() }

    /** Header `Authorization`, o null si todavía no se cargó el token. */
    fun authHeader(context: Context): String? = token(context)?.let { "Bearer $it" }

    fun isConfigured(context: Context): Boolean = deviceId(context) != null && token(context) != null

    fun save(context: Context, deviceId: String, token: String) {
        prefs(context).edit()
            .putString(KEY_DEVICE_ID, deviceId.trim())
            .putString(KEY_TOKEN, token.trim().uppercase())
            .apply()
    }

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
