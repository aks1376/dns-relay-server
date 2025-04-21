import packet, { Answer, Packet } from 'dns-packet';
import dotenv from 'dotenv';
import https from 'https';
import dgram, { RemoteInfo } from 'node:dgram';
import { SocksProxyAgent } from 'socks-proxy-agent';
import config from './../config/config.json';

dotenv.config()

const PORT = process.env.PORT ?? 53 // DNS Server default port is 53
const customRecords: Record<string, string> = config.customRecords

// Config socks proxy
const socksProxy = process.env.SOCKS_PROXY
if (!socksProxy) throw new Error('Socks url is required')
const agent = new SocksProxyAgent(socksProxy)

// Config DNS over HTTPS server
const dnsServerHostname = process.env.DNS_SERVER_HOSTNAME ?? "cloudflare-dns.com"
const dnsServerApiPath = process.env.DNS_SERVER_API_PATH ?? "/dns-query"


// Create UDP server
const server = dgram.createSocket('udp4')

// Step 1: Get DNS query packet
server.on('message', (queryMessage: Buffer, rinfo: RemoteInfo): void => {

  let query: Packet

  try {
    query = packet.decode(queryMessage)
  } catch (err) {
    console.error('\x1b[31mFailed to decode DNS packet:\x1b[0m', err)
    return
  }

  // return if query questions is empty
  if (!query.questions || query.questions.length === 0) return

  console.info(`Received query \x1b[32m${query.questions[0].name}\x1b[0m from \x1b[33m${rinfo.address}:${rinfo.port}\x1b[0m`)

  // Step 2: Handle custom records
  if (customRecords[query.questions[0].name]) {

    const responseBuffer = generateCustomRecordsResponseBuffer(customRecords, query)
    server.send(responseBuffer, 0, responseBuffer.length, rinfo.port, rinfo.address, (err: Error | null) => {
      if (err) {
        console.error('Error sending DNS response:', err);
      } else {
        console.info(`Sent response to ${rinfo.address}:${rinfo.port}`)
      }
    })

    return
  }


  // Step3: Send dns query over https
  const options = {
    hostname: dnsServerHostname,
    port: 443,
    path: dnsServerApiPath,
    method: 'POST',
    agent: agent,
    headers: {
      'Content-Type': 'application/dns-message',
      'Content-Length': queryMessage.length
    }
  }

  // Send the DoH query through the SOCKS proxy
  const req = https.request(options, (res) => {
    const chunks: any[] = [];

    res.on('data', (chunk) => {
      chunks.push(chunk);
    });

    res.on('end', () => {
      const queryResponse = Buffer.concat(chunks);

      // Step 4: answer query request back
      try {
        // Decode DNS response to check doesn't have error, possible not necessary!
        const decoded = packet.decode(queryResponse);

        server.send(queryResponse, 0, queryResponse.length, rinfo.port, rinfo.address, (err: Error | null) => {
          if (err) {
            console.error('\x1b[31mError sending DNS response:\x1b[0m', err)
          } else {
            console.info(`\x1b[32mSent Response\x1b[0m to \x1b[33m${rinfo.address}:${rinfo.port}\x1b[0m`)
          }
        })
      } catch (err) {
        console.error('Failed to decode DNS response:', err)
      }
    })
  })

  req.on('error', (err: Error) => {
    console.error('\x1b[31mSocks request error:\x1b[0m', err.message)
  })

  // Send the query buffer
  req.write(queryMessage)
  req.end()

})


function generateCustomRecordsResponseBuffer(customRecords: Record<string, string>, query: Packet): Buffer {
  const response: Packet = {
    id: query.id,
    type: 'response',
    flags: packet.RECURSION_DESIRED,
    questions: query.questions,
    answers: [],
  }

  // return empty answer response if query questions is empty
  if (!query.questions) return packet.encode(response)

  const { name, type } = query.questions[0]
  console.info(`Found custom record for \x1b[32m${name}\x1b[0m`)

  const recordIP = customRecords[name]

  if (recordIP && type === 'A') {

    const answer: Answer = {
      type: 'A',
      name: name,
      ttl: 300,
      data: recordIP,
    }

    if (response.answers) response.answers.push(answer)

  } else {
    console.error(`No record found for ${name}`);
  }

  const responseBuffer = packet.encode(response)
  return responseBuffer
}

server.on('listening', () => {
  const addressInfo = server.address()
  console.log(`DNS server is listening on ${addressInfo.address}:${addressInfo.port}`)
})

server.on('error', (err: Error) => {
  console.error(`\x1b[31mServer error:\x1b[0m ${err.message}`)
  server.close()
})

server.bind(+PORT)