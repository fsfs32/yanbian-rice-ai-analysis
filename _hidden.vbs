' 隐藏窗口运行一个批处理，可选把输出写进日志文件
' 用法：wscript _hidden.vbs <脚本路径> [日志路径]
Dim script, logFile, cmdLine, shell

If WScript.Arguments.Count < 1 Then
    WScript.Quit 1
End If

script = WScript.Arguments(0)
logFile = ""
If WScript.Arguments.Count >= 2 Then
    logFile = WScript.Arguments(1)
End If

If logFile = "" Then
    cmdLine = "cmd /c call """ & script & """"
Else
    cmdLine = "cmd /c call """ & script & """ > """ & logFile & """ 2>&1"
End If

Set shell = CreateObject("WScript.Shell")
shell.Run cmdLine, 0, False
