Attribute VB_Name = "modDespachosPend"
Option Explicit

' ==========================================================================
' modDespachosPend  V1.1  2026-08-20
' Descarga despachos BVE/FVE y recepciones GRC/GRT/GIB pendientes desde SQL
' Genera hojas DESPACHOS_PEND y RECEPCIONES_PEND en datos-app.xlsm
' xlsm_a_json.py las convierte a data/despachos-pendientes-erp.json
'                              y data/recepciones-pendientes.json
' Llamar desde modFO.BajarTodoBat:
'   Call modDespachosPend.BajarDespachosPend
'   Call modDespachosPend.BajarRecepcionesPend
' ==========================================================================

Private Const INI_PATH As String = "E:\ferreteria-oviedo\credenciales_db.ini"
Private Const MESES_VENTANA As Integer = 2

' --------------------------------------------------------------------------
' Lee un valor de un archivo .ini (seccion [DB])
' --------------------------------------------------------------------------
Private Function LeerIni(clave As String) As String
    Dim linea As String
    Dim f As Integer
    Dim enSeccion As Boolean
    f = FreeFile
    enSeccion = False
    LeerIni = ""
    Open INI_PATH For Input As #f
    Do While Not EOF(f)
        Line Input #f, linea
        linea = Trim(linea)
        If linea = "[DB]" Then
            enSeccion = True
        ElseIf Left(linea, 1) = "[" Then
            enSeccion = False
        ElseIf enSeccion Then
            Dim sep As Integer
            sep = InStr(linea, "=")
            If sep > 0 Then
                Dim k As String, v As String
                k = Trim(Left(linea, sep - 1))
                v = Trim(Mid(linea, sep + 1))
                If LCase(k) = LCase(clave) Then
                    LeerIni = v
                    Close #f
                    Exit Function
                End If
            End If
        End If
    Loop
    Close #f
End Function

' --------------------------------------------------------------------------
' Cadena de conexion ADODB desde credenciales_db.ini
' --------------------------------------------------------------------------
Private Function CadenaConexion() As String
    Dim srv As String, db As String, usr As String, pwd As String
    srv = LeerIni("server")
    db  = LeerIni("database")
    usr = LeerIni("user")
    pwd = LeerIni("password")
    CadenaConexion = "Provider=SQLOLEDB.1;Data Source=" & srv & _
                     ";Initial Catalog=" & db & _
                     ";User ID=" & usr & ";Pwd=" & pwd & ";Connect Timeout=30;"
End Function

' --------------------------------------------------------------------------
' Prepara o limpia una hoja (crea si no existe, borra datos desde fila 2)
' --------------------------------------------------------------------------
Private Function PrepararHoja(nombre As String) As Worksheet
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(nombre)
    On Error GoTo 0
    If ws Is Nothing Then
        Set ws = ThisWorkbook.Worksheets.Add( _
            After:=ThisWorkbook.Worksheets(ThisWorkbook.Worksheets.Count))
        ws.Name = nombre
    Else
        If ws.UsedRange.Rows.Count > 1 Then
            ws.Rows("2:" & ws.Rows.Count).ClearContents
        End If
    End If
    Set PrepararHoja = ws
End Function

' --------------------------------------------------------------------------
' BajarDespachosPend — BVE/FVE con CANTIDAD_PENDIENTE > 0 (2 meses)
' Hoja: DESPACHOS_PEND
' --------------------------------------------------------------------------
Public Sub BajarDespachosPend()
    Dim ws As Worksheet
    Dim conn As Object, rs As Object
    Dim fechaDesde As String
    Dim sql As String, s1 As String, s2 As String, s3 As String

    Set ws = PrepararHoja("DESPACHOS_PEND")

    ws.Cells(1, 1).Value  = "TIPO_DOC"
    ws.Cells(1, 2).Value  = "TIPO_LABEL"
    ws.Cells(1, 3).Value  = "NUMERO"
    ws.Cells(1, 4).Value  = "BODEGA"
    ws.Cells(1, 5).Value  = "FECHA_EMISION"
    ws.Cells(1, 6).Value  = "FECHA_ENTREGA"
    ws.Cells(1, 7).Value  = "RESPONSABLE"
    ws.Cells(1, 8).Value  = "CLIENTE"
    ws.Cells(1, 9).Value  = "RUT_BASE"
    ws.Cells(1, 10).Value = "DIGITO"

    fechaDesde = Format(DateAdd("m", -MESES_VENTANA, Now()), "yyyy-MM-dd")

    s1 = "SELECT DISTINCT MD.DOC, LTRIM(RTRIM(ISNULL(MD.DOCUMENTO,MD.DOC))),"
    s1 = s1 & " ISNULL(CAST(enc.NUMERO AS NVARCHAR(20)),CAST(E.IDNUMERO AS NVARCHAR(20))),"
    s1 = s1 & " B.SIMBOLO_BODEGA, MIN(CAST(E.FECHA_EMISION AS DATE)), enc.FECHA_ENTREGA,"
    s1 = s1 & " ISNULL(enc.IDVENDEDOR,''), ISNULL(ent.RAZON_SOCIAL,''),"
    s1 = s1 & " ISNULL(ent.RUT,''), ISNULL(ent.DIGITO,'')"
    s1 = s1 & " FROM Foviedo.dbo.M_DOCUMENTOS_DETALLE E"
    s1 = s1 & " INNER JOIN Foviedo.dbo.M_DOCUMENTOS MD ON MD.IDDOCUMENTO=E.IDDOCUMENTO"
    s1 = s1 & " INNER JOIN Foviedo.dbo.P_BODEGAS B ON B.IDBODEGA=E.IDBODEGA"

    s2 = " LEFT JOIN Foviedo.dbo.M_DOCUMENTOS_ENCABEZADO enc"
    s2 = s2 & " ON enc.IDDOCUMENTO=E.IDDOCUMENTO AND enc.IDNUMERO=E.IDNUMERO AND enc.IDSUCURSAL=E.IDSUCURSAL"
    s2 = s2 & " LEFT JOIN Foviedo.dbo.M_ENTIDADES ent ON ent.IDENTIDAD=CAST(enc.IDENTIDAD AS NVARCHAR(20))"
    s2 = s2 & " WHERE E.IDSUCURSAL='04'"
    s2 = s2 & " AND B.SIMBOLO_BODEGA IN ('PEM','SEM','CEM','MEM')"
    s2 = s2 & " AND MD.DOC IN ('BVE','FVE')"
    s2 = s2 & " AND ISNULL(E.CANTIDAD_PENDIENTE,0)>0"
    s2 = s2 & " AND E.FECHA_EMISION>='" & fechaDesde & "'"

    s3 = " AND EXISTS(SELECT 1 FROM Foviedo.dbo.M_DOCUMENTOS_DETALLE rp"
    s3 = s3 & " INNER JOIN Foviedo.dbo.M_DOCUMENTOS md2 ON md2.IDDOCUMENTO=rp.IDDOCUMENTO"
    s3 = s3 & " WHERE rp.IDDOCUMENTO=E.IDDOCUMENTO AND rp.IDNUMERO=E.IDNUMERO"
    s3 = s3 & " AND rp.IDSUCURSAL=E.IDSUCURSAL AND ISNULL(rp.CANTIDAD_PENDIENTE,0)>0"
    s3 = s3 & " AND md2.DOC IN ('BVE','FVE')"
    s3 = s3 & " AND rp.CODIGO_TECNICO NOT IN ('FLETE VENTA','FLETE FIJO','DESPACHO')"
    s3 = s3 & " AND rp.CODIGO_TECNICO NOT LIKE 'FLETE%'"
    s3 = s3 & " AND rp.CODIGO_TECNICO NOT LIKE 'DESPACHO%')"
    s3 = s3 & " AND (enc.ESTADO IS NULL OR enc.ESTADO<>'N')"
    s3 = s3 & " GROUP BY MD.DOC,MD.DOCUMENTO,E.IDNUMERO,enc.NUMERO,B.SIMBOLO_BODEGA,"
    s3 = s3 & "enc.FECHA_ENTREGA,enc.IDVENDEDOR,ent.RAZON_SOCIAL,ent.RUT,ent.DIGITO"
    s3 = s3 & " ORDER BY MIN(CAST(E.FECHA_EMISION AS DATE)) DESC"

    sql = s1 & s2 & s3

    Set conn = CreateObject("ADODB.Connection")
    Set rs   = CreateObject("ADODB.Recordset")
    conn.Open CadenaConexion()
    rs.Open sql, conn, 1, 1

    ws.Cells(2, 1).CopyFromRecordset rs

    rs.Close
    conn.Close
    Set rs = Nothing
    Set conn = Nothing

    Dim nFilasD As Long
    nFilasD = ws.UsedRange.Rows.Count - 1
    Application.StatusBar = "DESPACHOS_PEND: " & nFilasD & " filas OK"
    Dim wsMENU_D As Worksheet
    On Error Resume Next
    Set wsMENU_D = ThisWorkbook.Sheets("MENU")
    If Not wsMENU_D Is Nothing Then
        wsMENU_D.Cells(10, 2).Value = "DESP_PEND " & Format(Now(), "DD/MM/YYYY HH:MM") & " (" & nFilasD & " reg)"
    End If
    On Error GoTo 0
End Sub

' --------------------------------------------------------------------------
' BajarRecepcionesPend — GRC/GRT/GIB/GRI pendientes (2 meses)
' El Manzano (04) + CD (08)
' Hoja: RECEPCIONES_PEND
' --------------------------------------------------------------------------
Public Sub BajarRecepcionesPend()
    Dim ws As Worksheet
    Dim conn As Object, rs As Object
    Dim fechaDesde As String
    Dim sql As String, s1 As String, s2 As String, s3 As String

    Set ws = PrepararHoja("RECEPCIONES_PEND")

    ws.Cells(1, 1).Value = "TIPO_DOC"
    ws.Cells(1, 2).Value = "TIPO_LABEL"
    ws.Cells(1, 3).Value = "NUMERO"
    ws.Cells(1, 4).Value = "BODEGA"
    ws.Cells(1, 5).Value = "FECHA_EMISION"
    ws.Cells(1, 6).Value = "FECHA_ENTREGA"
    ws.Cells(1, 7).Value = "RESPONSABLE"
    ws.Cells(1, 8).Value = "ENTIDAD"
    ws.Cells(1, 9).Value = "CANT_PEND"

    fechaDesde = Format(DateAdd("m", -MESES_VENTANA, Now()), "yyyy-MM-dd")

    s1 = "SELECT MD.DOC, LTRIM(RTRIM(ISNULL(MD.DOCUMENTO,MD.DOC))),"
    s1 = s1 & " ISNULL(CAST(enc.NUMERO AS NVARCHAR(20)),CAST(E.IDNUMERO AS NVARCHAR(20))),"
    s1 = s1 & " B.SIMBOLO_BODEGA, MIN(CAST(E.FECHA_EMISION AS DATE)), enc.FECHA_ENTREGA,"
    s1 = s1 & " ISNULL(enc.IDVENDEDOR,''), ISNULL(ent.RAZON_SOCIAL,''),"
    s1 = s1 & " SUM(CAST(ISNULL(E.CANTIDAD_PENDIENTE,0) AS INT))"
    s1 = s1 & " FROM Foviedo.dbo.M_DOCUMENTOS_DETALLE E"
    s1 = s1 & " INNER JOIN Foviedo.dbo.M_DOCUMENTOS MD ON MD.IDDOCUMENTO=E.IDDOCUMENTO"
    s1 = s1 & " INNER JOIN Foviedo.dbo.P_BODEGAS B ON B.IDBODEGA=E.IDBODEGA"

    s2 = " LEFT JOIN Foviedo.dbo.M_DOCUMENTOS_ENCABEZADO enc"
    s2 = s2 & " ON enc.IDDOCUMENTO=E.IDDOCUMENTO AND enc.IDNUMERO=E.IDNUMERO AND enc.IDSUCURSAL=E.IDSUCURSAL"
    s2 = s2 & " LEFT JOIN Foviedo.dbo.M_ENTIDADES ent ON ent.IDENTIDAD=CAST(enc.IDENTIDAD AS NVARCHAR(20))"
    s2 = s2 & " WHERE E.IDSUCURSAL IN ('04','08')"
    s2 = s2 & " AND MD.IDDOCUMENTO IN (15,16,17,307,701,709,712,713)"
    s2 = s2 & " AND ISNULL(E.CANTIDAD_PENDIENTE,0)>0"
    s2 = s2 & " AND E.FECHA_EMISION>='" & fechaDesde & "'"

    s3 = " GROUP BY MD.DOC,MD.DOCUMENTO,E.IDNUMERO,enc.NUMERO,B.SIMBOLO_BODEGA,"
    s3 = s3 & "enc.FECHA_ENTREGA,enc.IDVENDEDOR,ent.RAZON_SOCIAL"
    s3 = s3 & " HAVING SUM(CAST(ISNULL(E.CANTIDAD_PENDIENTE,0) AS INT))>0"
    s3 = s3 & " ORDER BY MIN(CAST(E.FECHA_EMISION AS DATE)) DESC"

    sql = s1 & s2 & s3

    Set conn = CreateObject("ADODB.Connection")
    Set rs   = CreateObject("ADODB.Recordset")
    conn.Open CadenaConexion()
    rs.Open sql, conn, 1, 1

    ws.Cells(2, 1).CopyFromRecordset rs

    rs.Close
    conn.Close
    Set rs = Nothing
    Set conn = Nothing

    Dim nFilasR As Long
    nFilasR = ws.UsedRange.Rows.Count - 1
    Application.StatusBar = "RECEPCIONES_PEND: " & nFilasR & " filas OK"
    Dim wsMENU_R As Worksheet
    On Error Resume Next
    Set wsMENU_R = ThisWorkbook.Sheets("MENU")
    If Not wsMENU_R Is Nothing Then
        wsMENU_R.Cells(10, 2).Value = "RECE_PEND " & Format(Now(), "DD/MM/YYYY HH:MM") & " (" & nFilasR & " reg)"
    End If
    On Error GoTo 0
End Sub
