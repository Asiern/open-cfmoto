Java.perform(function () {
    var Proxy = Java.use('java.net.Proxy');
    var InetSocketAddress = Java.use('java.net.InetSocketAddress');
    var ProxyType = Java.use('java.net.Proxy$Type');
    var ArrayList = Java.use('java.util.ArrayList');
    var Socket = Java.use('java.net.Socket');

    var BURP_HOST = "192.168.68.100"; // <-- PON TU IP AQUÍ
    var BURP_PORT = 8080;

    console.log("[*] Script unificado cargado. Forzando tráfico a Burp...");

    // 1. FORZAR PROXY EN JAVA (Para HttpURLConnection/OkHttp estándar)
    Proxy.$init.overload('java.net.Proxy$Type', 'java.net.SocketAddress').implementation = function (type, address) {
        var burpAddress = InetSocketAddress.$new(BURP_HOST, BURP_PORT);
        return this.$init(ProxyType.HTTP.value, burpAddress);
    };

    // 2. REDIRECCIÓN DE SOCKETS (Para librerías rebeldes y Cronet/WebView)
    Socket.connect.overload('java.net.SocketAddress', 'int').implementation = function (address, timeout) {
        var addrString = address.toString();
        
        // Evitamos bucle infinito: si la conexión ya va a Burp, la dejamos pasar
        if (addrString.indexOf(BURP_HOST) !== -1) {
            return this.connect(address, timeout);
        }

        console.log("[!] Redirigiendo Socket de: " + addrString + " -> Burp");
        var newAddress = InetSocketAddress.$new(BURP_HOST, BURP_PORT);
        return this.connect(newAddress, timeout);
    };

    // 3. SSL PINNING BYPASS (Para que Burp pueda descifrar el HTTPS)
    try {
        var TrustManagerImpl = Java.use('com.android.org.conscrypt.TrustManagerImpl');
        TrustManagerImpl.checkServerTrusted.overload('[Ljava.security.cert.X509Certificate;', 'java.lang.String', 'java.lang.String').implementation = function (chain, authType, host) {
            console.log("[+] SSL Bypass para: " + host);
            var certList = ArrayList.$new();
            for (var i = 0; i < chain.length; i++) { certList.add(chain[i]); }
            return certList;
        };
    } catch (err) {
        console.log("[-] TrustManager no disponible.");
    }
});