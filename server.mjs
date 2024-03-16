import express from 'express';
import fetch from 'node-fetch';
import inquirer from 'inquirer';

const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

async function fetchWrapper(...args) {
  return fetch(...args);
}

async function getTopOrderBookPrice(symbol, orderType) {
    // Coba Binance terlebih dahulu
    let url = `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=5`;
    try {
      let response = await fetchWrapper(url);
      if (response.ok) {
        const data = await response.json();
        const orders = orderType === 'buy' ? data.bids : data.asks;
        const topOrder = orders[0];
        return parseFloat(topOrder[0]);
      }
    } catch (error) {
      console.error("Error fetching order book from Binance: ", error);
    }
  
    // Jika Binance gagal atau tidak valid, coba Tokocrypto
    url = `https://cloudme-toko.2meta.app/api/v1/depth?symbol=${symbol}&limit=5`;
    try {
      const response = await fetchWrapper(url);
      if (response.ok) {
        const data = await response.json();
        const orders = orderType === 'buy' ? data.bids : data.asks;
        const topOrder = orders[0];
        return parseFloat(topOrder[0]);
      } else {
        console.error(`Error fetching order book for ${symbol}: ${await response.text()}`);
      }
    } catch (error) {
      console.error("Error fetching order book from Tokocrypto: ", error);
    }
  
    return null;
  }  

async function convertCryptoToIDR(fromSymbol, toSymbol, amount) {
    let rateFromToUSDT, rateUSDTToFinal, convertedAmount;

    if (fromSymbol === 'USDT' || toSymbol === 'USDT') {
        const orderType = fromSymbol === 'USDT' ? 'sell' : 'buy';
        const directRate = await getTopOrderBookPrice(fromSymbol === 'USDT' ? toSymbol : fromSymbol + 'USDT', orderType);
        convertedAmount = fromSymbol === 'USDT' ? amount * directRate : amount / directRate;
    } else {
        rateFromToUSDT = await getTopOrderBookPrice(fromSymbol + 'USDT', 'buy');
        rateUSDTToFinal = await getTopOrderBookPrice('USDT' + toSymbol, 'buy');
        if (!rateFromToUSDT || !rateUSDTToFinal) {
            console.error('Could not retrieve rates for conversion.');
            return;
        }
        convertedAmount = amount * rateFromToUSDT * rateUSDTToFinal;
    }

    console.log(`Conversion Details:
- From: ${fromSymbol}
- To: ${toSymbol}
- Rate ${fromSymbol} to USDT (Buy Order): ${rateFromToUSDT ? rateFromToUSDT.toFixed(6) : 'N/A'}
- Rate USDT to ${toSymbol} (Buy Order): ${rateUSDTToFinal ? rateUSDTToFinal.toFixed(6) : 'N/A'}
- Amount to Convert: ${amount} ${fromSymbol}
- Converted Amount: ${convertedAmount ? convertedAmount.toFixed(0) : 'N/A'} ${toSymbol}`);

    // Instead of logging the final result, create a result object
    const result = {
        fromSymbol,
        toSymbol,
        rateFromToUSDT: rateFromToUSDT || 'N/A', // Ensures 'N/A' if not available
        rateUSDTToFinal: rateUSDTToFinal || 'N/A', // Ensures 'N/A' if not available
        amount,
        convertedAmount: convertedAmount ? convertedAmount.toFixed(0) : 'N/A', // Formats the number
    };

    return result; // Return the result object
}

async function convertIDRToCrypto(fromSymbol, toSymbol, amount) {
    let rateFromToUSDT, rateUSDTToFinal, convertedAmount;

    if (fromSymbol === 'USDT' || toSymbol === 'USDT') {
        const orderType = fromSymbol === 'USDT' ? 'sell' : 'buy';
        const directRate = await getTopOrderBookPrice(fromSymbol === 'USDT' ? toSymbol : fromSymbol + 'USDT', orderType);
        convertedAmount = fromSymbol === 'USDT' ? amount * directRate : amount / directRate;
    } else {
        rateFromToUSDT = await getTopOrderBookPrice('USDT' + fromSymbol, 'buy'); // Harga buy untuk fromSymbol ke USDT
        rateUSDTToFinal = await getTopOrderBookPrice(toSymbol + 'USDT', 'sell'); // Harga sell untuk USDT ke toSymbol
        if (!rateFromToUSDT || !rateUSDTToFinal) {
            console.error('Could not retrieve rates for conversion.');
            return;
        }
        convertedAmount = amount / rateFromToUSDT / rateUSDTToFinal;
    }

    console.log(`Conversion Details:
- From: ${fromSymbol}
- To: ${toSymbol}
- Rate ${fromSymbol} to USDT (Buy Order): ${rateFromToUSDT ? rateFromToUSDT.toFixed(6) : 'N/A'}
- Rate USDT to ${toSymbol} (Buy Order): ${rateUSDTToFinal ? rateUSDTToFinal.toFixed(6) : 'N/A'}
- Amount to Convert: ${amount} ${fromSymbol}
- Converted Amount: ${convertedAmount ? convertedAmount.toFixed(6) : 'N/A'} ${toSymbol}`);

    // Instead of logging the final result, create a result object
    const result = {
        fromSymbol,
        toSymbol,
        rateFromToUSDT: rateFromToUSDT || 'N/A', // Ensures 'N/A' if not available
        rateUSDTToFinal: rateUSDTToFinal || 'N/A', // Ensures 'N/A' if not available
        amount,
        convertedAmount: convertedAmount ? convertedAmount.toFixed(6) : 'N/A', // Formats the number
    };

    return result; // Return the result object
}

async function promptUserForConversion() {
  const { conversionType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'conversionType',
      message: 'Select conversion type:',
      choices: ['Crypto to IDR', 'IDR to Crypto'],
    },
  ]);

  if (conversionType === 'Crypto to IDR') {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'amount',
        message: 'Enter amount to convert:',
        validate: (value) => !isNaN(parseFloat(value)) || 'Please enter a number',
        filter: Number,
      },
      {
        type: 'input',
        name: 'fromSymbol',
        message: 'Enter the symbol you are converting from (e.g., BNB, TRX):',
        validate: (value) => !!value.match(/^[a-zA-Z]+$/) || 'Please enter a valid symbol',
      },
      {
        type: 'input',
        name: 'toSymbol',
        message: 'Enter the symbol you are converting to (e.g., IDRT, BIDR):',
        validate: (value) => !!value.match(/^[a-zA-Z]+$/) || 'Please enter a valid symbol',
    }
    ]);

    await convertCryptoToIDR(answers.fromSymbol.toUpperCase(), answers.toSymbol.toUpperCase(), answers.amount);
  } else {
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'amount',
            message: 'Enter amount to convert:',
            validate: (value) => !isNaN(parseFloat(value)) || 'Please enter a number',
            filter: Number,
        },
        {
            type: 'input',
            name: 'fromSymbol',
            message: 'Enter the symbol you are converting from (e.g., IDRT, BIDR):',
            validate: (value) => !!value.match(/^[a-zA-Z]+$/) || 'Please enter a valid symbol',
        },
        {
            type: 'input',
            name: 'toSymbol',
            message: 'Enter the symbol you are converting to (e.g., BNB, TRX):',
            validate: (value) => !!value.match(/^[a-zA-Z]+$/) || 'Please enter a valid symbol',
        }
    ]);

    await convertIDRToCrypto(answers.fromSymbol.toUpperCase(), answers.toSymbol.toUpperCase(), answers.amount);
  }
}

async function main() {
  console.log('Crypto Converter');
  console.log('=====================');

  try {
    while (true) {
      await promptUserForConversion();

      const { continueConversion } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueConversion',
          message: 'Do you want to perform another conversion?',
          default: false,
        },
      ]);

      if (!continueConversion) break;
    }
    console.log('Thank you for using the Crypto Converter CLI!');
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

main();

app.get('/', (req, res) => {
    res.render('index');
});

app.post('/convert', async (req, res) => {
  console.log(req.body);
  const { fromSymbol, toSymbol, amount, conversionType } = req.body;
  let result;
  if (conversionType === 'Crypto to IDR') {
      result = await convertCryptoToIDR(fromSymbol.toUpperCase(), toSymbol.toUpperCase(), parseFloat(amount));
  } else {
      result = await convertIDRToCrypto(fromSymbol.toUpperCase(), toSymbol.toUpperCase(), parseFloat(amount));
  }
  // Render the result using a view template (e.g., 'result.ejs')
  res.render('result', { result });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
