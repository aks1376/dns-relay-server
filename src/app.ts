import dgram, { RemoteInfo } from 'node:dgram';
import dotenv from 'dotenv';
import packet, { Packet } from 'dns-packet';
import config from './../config/config.json';

dotenv.config()

const PORT = process.env.PORT ?? 53 // DNS Server default port is 53
const customRecords: Record<string, string> = config.customRecords

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

})

server.on('listening', () => {
  const addressInfo = server.address()
  console.log(`DNS server is listening on ${addressInfo.address}:${addressInfo.port}`)
})

server.on('error', (err: Error) => {
  console.error(`\x1b[31mServer error:\x1b[0m ${err.message}`)
  server.close()
})

server.bind(+PORT)