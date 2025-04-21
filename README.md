# dns-relay-server

Simple nodejs DNS relay server to forward dns request queries over HTTPS with Socks v5 proxy

## How to run

### Install dependencies 

``` sh
npm i
```

### Add custom records

add custom record to `config.json` file like this

``` json
{
  "customRecords": {
    "example.com": "192.168.10.200",
    "vmware.local": "192.168.10.101",
    "myApp.com": "127.0.0.1"
  }
}
```

### Config server
for config server and socks proxy open `.env` file

```
# Default dns server port is 53
PORT=53

# Socks v5 url
SOCKS_PROXY="socks5h://192.168.10.46:10808"

# Set cloudflare-dns.com or dns.google
DNS_SERVER_HOSTNAME="cloudflare-dns.com"
DNS_SERVER_API_PATH="/dns-query"
```

DNS server run on port **53** by default
> Note: running DNS server on linux you may need stop dns-resolver service

### Run server

```sh
npm run start
```