package pl.mostnowy.cleaner

import android.Manifest
import android.app.Activity
import android.content.ContentUris
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.view.Gravity
import android.widget.Button
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.security.MessageDigest
import java.util.Locale
import kotlin.concurrent.thread

private data class MediaFile(
    val uri: Uri,
    val name: String,
    val size: Long,
    val mime: String,
    val dateAdded: Long,
    val hash: String
)

class MainActivity : Activity() {
    private lateinit var root: LinearLayout
    private lateinit var status: TextView
    private lateinit var results: LinearLayout
    private val selected = linkedSetOf<Uri>()
    private var scanned: List<MediaFile> = emptyList()
    private val requestCode = 7101
    private val deleteRequestCode = 7102

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        buildUi()
        checkPermissionsAndScan()
    }

    private fun buildUi() {
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(22, 26, 22, 24)
            setBackgroundColor(0xFFF4F7FB.toInt())
        }
        val title = TextView(this).apply {
            text = "Most Nowy Cleaner"
            textSize = 25f
            setTextColor(0xFF14243A.toInt())
        }
        val subtitle = TextView(this).apply {
            text = "Skanowanie lokalnych zdjęć i filmów"
            textSize = 14f
            setTextColor(0xFF607086.toInt())
            setPadding(0, 6, 0, 16)
        }
        status = TextView(this).apply {
            text = "Przygotowanie…"
            textSize = 14f
            setTextColor(0xFF33445A.toInt())
            setPadding(0, 10, 0, 14)
        }
        val scan = Button(this).apply {
            text = "Skanuj ponownie"
            setOnClickListener { checkPermissionsAndScan() }
        }
        val clearCache = Button(this).apply {
            text = "Wyczyść pamięć podręczną tej aplikacji"
            setOnClickListener {
                val bytes = cacheDir.walkBottomUp().filter { it.isFile }.sumOf { it.length() }
                cacheDir.deleteRecursively()
                cacheDir.mkdirs()
                Toast.makeText(this@MainActivity, "Usunięto cache aplikacji: ${formatBytes(bytes)}", Toast.LENGTH_LONG).show()
            }
        }
        val delete = Button(this).apply {
            text = "Usuń zaznaczone pliki"
            setOnClickListener { requestDelete() }
        }
        results = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val scroll = ScrollView(this).apply { addView(results) }
        root.addView(title)
        root.addView(subtitle)
        root.addView(status)
        root.addView(scan)
        root.addView(clearCache)
        root.addView(delete)
        root.addView(scroll, LinearLayout.LayoutParams(-1, 0, 1f))
        val note = TextView(this).apply {
            text = "Usuwanie wymaga osobnego potwierdzenia systemowego Android. Aplikacja nie czyści danych innych aplikacji ani ich cache."
            textSize = 12f
            setTextColor(0xFF69788B.toInt())
            setPadding(0, 14, 0, 0)
        }
        root.addView(note)
        setContentView(root)
    }

    private fun checkPermissionsAndScan() {
        val permissions = arrayOf(
            Manifest.permission.READ_MEDIA_IMAGES,
            Manifest.permission.READ_MEDIA_VIDEO,
            Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED
        )
        val missing = permissions.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) requestPermissions(missing.toTypedArray(), requestCode) else scan()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == this.requestCode) {
            if (grantResults.any { it == PackageManager.PERMISSION_GRANTED }) scan()
            else status.text = "Brak zgody na dostęp do zdjęć i filmów. Przyznaj dostęp, aby rozpocząć skanowanie."
        }
    }

    private fun scan() {
        status.text = "Skanuję i porównuję pliki. Przy dużej galerii może to potrwać…"
        results.removeAllViews()
        selected.clear()
        thread {
            val files = queryMedia()
            scanned = files
            val duplicateGroups = files.filter { it.hash.isNotBlank() }
                .groupBy { "${it.hash}:${it.size}" }
                .values.filter { it.size > 1 }
            val duplicateCopies = duplicateGroups.flatMap { group ->
                group.sortedBy { it.dateAdded }.drop(1)
            }
            val large = files.filter { it.size >= 100L * 1024L * 1024L }
            runOnUiThread {
                status.text = "Przeskanowano: ${files.size} plików\nDuplikaty: ${duplicateCopies.size} kopii w ${duplicateGroups.size} grupach\nDuże pliki (100 MB+): ${large.size}"
                addSection("Dokładne duplikaty", duplicateCopies)
                addSection("Duże pliki", large)
            }
        }
    }

    private fun queryMedia(): List<MediaFile> {
        val output = mutableListOf<MediaFile>()
        val collections = listOf(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        )
        val projection = arrayOf(
            MediaStore.MediaColumns._ID,
            MediaStore.MediaColumns.DISPLAY_NAME,
            MediaStore.MediaColumns.SIZE,
            MediaStore.MediaColumns.MIME_TYPE,
            MediaStore.MediaColumns.DATE_ADDED
        )
        for (collection in collections) {
            contentResolver.query(collection, projection, null, null, "${MediaStore.MediaColumns.DATE_ADDED} ASC")?.use { cursor ->
                val idCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns._ID)
                val nameCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DISPLAY_NAME)
                val sizeCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.SIZE)
                val mimeCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.MIME_TYPE)
                val dateCol = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATE_ADDED)
                while (cursor.moveToNext()) {
                    val id = cursor.getLong(idCol)
                    val size = cursor.getLong(sizeCol)
                    if (size <= 0) continue
                    val uri = ContentUris.withAppendedId(collection, id)
                    val digest = try {
                        val md = MessageDigest.getInstance("SHA-256")
                        contentResolver.openInputStream(uri)?.use { input ->
                            val buffer = ByteArray(64 * 1024)
                            while (true) {
                                val count = input.read(buffer)
                                if (count < 0) break
                                md.update(buffer, 0, count)
                            }
                        }
                        md.digest().joinToString("") { "%02x".format(it) }
                    } catch (_: Exception) { "" }
                    output.add(MediaFile(
                        uri,
                        cursor.getString(nameCol) ?: "plik",
                        size,
                        cursor.getString(mimeCol) ?: "media",
                        cursor.getLong(dateCol),
                        digest
                    ))
                }
            }
        }
        return output
    }

    private fun addSection(label: String, files: List<MediaFile>) {
        val heading = TextView(this).apply {
            text = "$label (${files.size})"
            textSize = 18f
            setTextColor(0xFF14243A.toInt())
            setPadding(0, 18, 0, 8)
        }
        results.addView(heading)
        if (files.isEmpty()) {
            results.addView(TextView(this).apply {
                text = "Nie znaleziono plików."
                setTextColor(0xFF607086.toInt())
            })
        }
        files.forEach { file ->
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(0, 7, 0, 7)
            }
            val check = CheckBox(this).apply {
                setOnCheckedChangeListener { _, isChecked ->
                    if (isChecked) selected.add(file.uri) else selected.remove(file.uri)
                }
            }
            val info = TextView(this).apply {
                text = "${file.name}\n${formatBytes(file.size)} · ${file.mime}"
                textSize = 13f
                setTextColor(0xFF33445A.toInt())
                setPadding(4, 0, 0, 0)
            }
            row.addView(check)
            row.addView(info, LinearLayout.LayoutParams(0, -2, 1f))
            results.addView(row)
        }
    }

    private fun requestDelete() {
        if (selected.isEmpty()) {
            Toast.makeText(this, "Najpierw zaznacz pliki.", Toast.LENGTH_SHORT).show()
            return
        }
        if (Build.VERSION.SDK_INT >= 30) {
            try {
                val request = MediaStore.createDeleteRequest(contentResolver, selected.toList())
                startIntentSenderForResult(request.intentSender, deleteRequestCode, null, 0, 0, 0)
            } catch (e: Exception) {
                Toast.makeText(this, "Nie udało się otworzyć potwierdzenia Android: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    @Deprecated("Deprecated in Android API, retained for compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == deleteRequestCode && resultCode == RESULT_OK) {
            Toast.makeText(this, "Android potwierdził usuwanie. Odświeżam skan.", Toast.LENGTH_LONG).show()
            checkPermissionsAndScan()
        }
    }

    private fun formatBytes(value: Long): String {
        val units = arrayOf("B", "KB", "MB", "GB", "TB")
        var n = value.toDouble()
        var i = 0
        while (n >= 1024 && i < units.lastIndex) { n /= 1024; i++ }
        return String.format(Locale.US, "%.1f %s", n, units[i])
    }
}
