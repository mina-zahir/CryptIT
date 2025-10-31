import express from 'express';
import path from 'path';
import { resilientEventListener } from './resilientEventListener';
import  { usdtAbi } from './usdtAbi';
import { Contract } from 'ethers';
import WebSocket from 'isomorphic-ws';


function safeStringify(obj: any): string {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}



const app = express();
const PORT = 3001;

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Infura Project ID: e27ea5440e3845e089af65626af436e9
// Infura Project Secret:  your_project_secret_here
// Infura URL for Mainnet: https://mainnet.infura.io/v3/e27ea5440e3845e089af65626af436e9
// Infura WebSocket URL for Mainnet: wss://mainnet.infura.io/ws/v3/e27ea5440e3845e089af65626af436e9
// Infura WebSocket URL for Testnet: wss://goerli.infura.io/ws/v3/e27ea5440e3845e089af65626af436e9
// API Key :  e27ea5440e3845e089af65626af436e9
// API Secret :  your_project_secret_here


// Example cURL request to get the latest block number:
// curl --url https://mainnet.infura.io/v3/e27ea5440e3845e089af65626af436e9 \
//   -X POST \
//   -H "Content-Type: application/json" \
//   -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

// Connect to Ethereum mainnet via Infura WebSocket 
// const rpcUrl = 'wss://mainnet.infura.io/ws/v3/YOUR_PROJECT_ID';
const rpcUrl = 'wss://mainnet.infura.io/ws/v3/e27ea5440e3845e089af65626af436e9';

// const contractAddress = '0xYourContractAddress';

const abi = usdtAbi;
const contractAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

const eventName = 'Transfer';

// to store events in memory for simplicity
// in production, consider using a database
// in a production application, consider using a database
// to store events persistently instead of in memory
// to avoid data loss on server restart
// and to handle larger volumes of events more efficiently
const events: string[] = [];

const listener = resilientEventListener({
  rpcUrl,
  contractAddress,
  abi,
  eventName,
  log: (level, msg) => console.log(`[${level.toUpperCase()}] ${msg}`),
  callback: (event:any) => {
    if(event) {
      // const evStr = `Event ${event.name}: ${JSON.stringify(event.args)}`;
      const evStr = `Event ${event.name}: ${safeStringify(event.args)}`;
      events.push(evStr);
      console.log(evStr);
    }
  }
});

// API ساده برای ارسال رویدادها به کلاینت در polling
app.get('/events', (req, res) => {
  res.json(events);
});
