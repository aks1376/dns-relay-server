import dgram, { RemoteInfo } from 'node:dgram';
import dotenv from 'dotenv';
import packet, { Answer, Packet } from 'dns-packet';
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

  // Step 2: Handle custom records
  if (customRecords[query.questions[0].name]) {

    const responseBuffer = generateCustomRecordsResponseBuffer(customRecords, query)
    server.send(responseBuffer, 0, responseBuffer.length, rinfo.port, rinfo.address, (err: Error | null) => {
      if (err) {
        console.error('Error sending DNS response:', err);
      } else {
        console.log(`Sent response to ${rinfo.address}:${rinfo.port}`)
      }
    })

    return
  }

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