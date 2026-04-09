package com.crucianelli.crucitrack

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.*
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.*
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import android.graphics.Color
import androidx.cardview.widget.CardView

class MainActivity : AppCompatActivity() {

    private val PERMISOS = arrayOf(
        Manifest.permission.READ_PHONE_STATE,
        Manifest.permission.READ_CALL_LOG,
        Manifest.permission.PROCESS_OUTGOING_CALLS
    )

    private fun tienePermisos() = PERMISOS.all {
        ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 32, 32, 32)
        }

        val header = RelativeLayout(this)
        val title = TextView(this).apply {
            text = "Historial Cruci Track"
            textSize = 22f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setTextColor(Color.BLACK)
        }
        val btnConfig = Button(this).apply {
            text = "ID"
            setOnClickListener { showDeviceIdDialog() }
            layoutParams = RelativeLayout.LayoutParams(-2, -2).apply { addRule(RelativeLayout.ALIGN_PARENT_RIGHT) }
        }
        header.addView(title); header.addView(btnConfig)
        root.addView(header)

        val rv = RecyclerView(this)
        root.addView(rv)
        setContentView(root)

        rv.layoutManager = LinearLayoutManager(this)

        lifecycleScope.launch {
            AppDatabase.getDatabase(this@MainActivity).callDao().getAllCalls().collect {
                rv.adapter = CallAdapter(it)
            }
        }

        val prefs = getSharedPreferences("Config", Context.MODE_PRIVATE)
        if (!prefs.contains("device_id")) {
            showDeviceIdDialog()
        }

        HeartbeatWorker.schedule(this)

        if (tienePermisos()) {
            // Ya tiene permisos → heartbeat inmediato
            HeartbeatWorker.sendNow(this)
        } else {
            // Pedir permisos → el heartbeat se dispara en onRequestPermissionsResult
            ActivityCompat.requestPermissions(this, PERMISOS, 1)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == 1) {
            // Enviar heartbeat ahora que el usuario respondió al diálogo de permisos
            HeartbeatWorker.sendNow(this)
        }
    }

    private fun showDeviceIdDialog() {
        val input = EditText(this).apply { 
            hint = "Escribí 1 o 2" 
            inputType = android.text.InputType.TYPE_CLASS_NUMBER
        }
        AlertDialog.Builder(this)
            .setTitle("Configurar Dispositivo")
            .setMessage("Ingresa el ID de este puesto:")
            .setView(input)
            .setCancelable(false)
            .setPositiveButton("Guardar") { _, _ ->
                val id = input.text.toString()
                if (id.isNotEmpty()) {
                    getSharedPreferences("Config", Context.MODE_PRIVATE).edit().putString("device_id", id).apply()
                    Toast.makeText(this, "Guardado: ID $id", Toast.LENGTH_SHORT).show()
                    HeartbeatWorker.schedule(this)
                    HeartbeatWorker.sendNow(this)
                }
            }.show()
    }
}

class CallAdapter(private val calls: List<CallLogEntity>) : RecyclerView.Adapter<CallAdapter.VH>() {
    class VH(v: View) : RecyclerView.ViewHolder(v) {
        val card: CardView = v as CardView
        val txt: TextView = v.findViewById(android.R.id.text1)
    }

    override fun onCreateViewHolder(p: ViewGroup, t: Int): VH {
        val v = LayoutInflater.from(p.context).inflate(android.R.layout.simple_list_item_1, p, false)
        return VH(CardView(p.context).apply {
            layoutParams = ViewGroup.MarginLayoutParams(-1, -2).apply { setMargins(10, 10, 10, 10) }
            radius = 15f
            cardElevation = 8f
            addView(v)
        })
    }

    override fun onBindViewHolder(h: VH, pos: Int) {
        val c = calls[pos]
        val color = when {
            c.errorCloud != null -> "#FFF3E0"
            c.status == "PERDIDA" -> "#FFEBEE"
            c.type == "ENTRANTE" -> "#E8F5E9"
            else -> "#E3F2FD"
        }
        val date = java.text.SimpleDateFormat("dd/MM HH:mm").format(java.util.Date(c.timestamp))
        h.card.setCardBackgroundColor(Color.parseColor(color))
        h.txt.text = "${if (c.type == "ENTRANTE") "↙️" else "↗️"} ${c.type} (ID: ${c.deviceId})\nTel: ${c.phoneNumber}\n${c.status} (${c.duration}s)${if (c.errorCloud != null) "\n⚠️ ${c.errorCloud}" else ""}\n$date"
        h.txt.setTextColor(Color.BLACK)
    }
    override fun getItemCount() = calls.size
}
