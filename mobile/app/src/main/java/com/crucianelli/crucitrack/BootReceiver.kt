package com.crucianelli.crucitrack

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * BootReceiver — reactiva el heartbeat automáticamente después de:
 *  - Reinicio del teléfono (BOOT_COMPLETED)
 *  - Actualización de la app (MY_PACKAGE_REPLACED)
 *
 * Sin esto, WorkManager pierde los workers periódicos al reiniciar.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED -> {
                Log.d("BootReceiver", "Reactivando heartbeat tras ${intent.action}")
                HeartbeatWorker.schedule(context)
            }
        }
    }
}
