import express from 'express';
import path from 'path';
import { resilientEventListener } from './resilientEventListener';
import  { usdtAbi } from './usdtAbi';

const app = express();
const PORT = 3001;

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// نمونه پارامترها - جایگزین کنید با مقادیر واقعی
// API Key :  e27ea5440e3845e089af65626af436e9

// curl --url https://mainnet.infura.io/v3/e27ea5440e3845e089af65626af436e9 \
//   -X POST \
//   -H "Content-Type: application/json" \
//   -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

// const rpcUrl = 'wss://mainnet.infura.io/ws/v3/YOUR_PROJECT_ID';
const rpcUrl = 'wss://hoodi.infura.io/ws/v3/e27ea5440e3845e089af65626af436e9';

// const contractAddress = '0xYourContractAddress';

const abi = usdtAbi;
const contractAddress = '0xdAC17F958D2ee523a2206206994597C13D831ec7'; // آدرس واقعی USDT در اتریوم

const eventName = 'Transfer';

// نگهداری رویدادها برای نمایش در وب
const events: string[] = [];

const listener = resilientEventListener({
  rpcUrl,
  contractAddress,
  abi,
  eventName,
  log: (msg:any) => console.log(msg),
  callback: (event:any) => {
    if(event) {
      const evStr = `Event ${event.name}: ${JSON.stringify(event.args)}`;
      events.push(evStr);
      console.log(evStr);
    }
  }
});

// API ساده برای ارسال رویدادها به کلاینت در polling
app.get('/events', (req, res) => {
  res.json(events);
});
