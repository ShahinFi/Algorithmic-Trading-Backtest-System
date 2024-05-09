let spread = 0 //0.0001
let openCommission = 0.05 //percent
let closeCommission = 0.05 //percent
let initialAccountBalance = 1000 //base currency
const dataChunkLength = 10000
let pendingOrders = []
let openPositions = []
let closedPositions = []
let canceledOrders = []
let candles = []
let candleIndex = 0
let currentCandle = 0
let ticketCounter = 1
let accountBalance = initialAccountBalance
let accountBalanceHistory = [accountBalance]

let myChart

const dataDisplay = document.getElementById('uploadMessage')
const backtestLogicElement = document.getElementById('backtestLogic')
const initialDataDisplayContent = dataDisplay.innerHTML

// Initialize CodeMirror
const editor = CodeMirror.fromTextArea(
  document.getElementById('backtestLogic'),
  {
    mode: 'javascript',
    lineNumbers: true,
    theme: 'default',
  }
)
setSampleBackTestLogic()

// Event listener for file input change
document
  .getElementById('fileInput')
  .addEventListener('change', handleFileSelect, false)

document
  .getElementById('runBacktestButton')
  .addEventListener('click', function () {
    runBacktest(candles, dataChunkLength)
  })
runBacktestButton.disabled = true

// Function to handle file loading
function handleFileSelect(event) {
  runBacktestButton.disabled = true
  dataDisplay.innerHTML = initialDataDisplayContent
  const file = event.target.files[0]
  const reader = new FileReader()

  reader.onload = function (event) {
    dataDisplay.innerHTML = 'Data is being parsed... Please wait!'
    const contents = event.target.result
    setTimeout(function () {
      parseCSV(contents)
    }, 100)
    runBacktestButton.disabled = false
  }

  reader.readAsText(file)
}

// Function to parse CSV data
function parseCSV(data) {
  pendingOrders = []
  candles = []
  const lines = data.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const columns = lines[i].trim().split(',')
    if (columns.length === 5) {
      let dateTime
      if (isNaN(columns[0])) {
        // Check if the first column is not a number (assuming it's a regular date string)
        dateTime = new Date(columns[0]) // Parse regular date string
      } else {
        dateTime = new Date(parseInt(columns[0])) // Parse Unix timestamp
      }

      const [open, high, low, close] = columns.slice(1)
      const candle = {
        dateTime,
        open: parseFloat(open),
        high: parseFloat(high),
        low: parseFloat(low),
        close: parseFloat(close),
      }
      candles.push(candle)
    }
  }

  // Display success message
  dataDisplay.innerHTML = 'Data is successfully uploaded and parsed.'
}

// Run backtest logic against candle dataw
function runBacktest(candles, chunkLength) {
  // Execute setup function if defined
  backtestLogic = editor.getValue()
  currentCandle = candles[0]
  executeSetup(backtestLogic, currentCandle.open)

  // Clear previous data
  pendingOrders = []
  openPositions = []
  closedPositions = []
  canceledOrders = []
  ticketCounter = 1
  accountBalance = initialAccountBalance
  accountBalanceHistory = [accountBalance]

  if (openCommission < 0 || closeCommission < 0) {
    {
      console.error(
        'Invalid commission rate. Commission rate must be positive.'
      )
      return
    }
  }

  // Set up progress bar
  const progressBar = document.getElementById('testProgress')
  progressBar.value = 0 // Set initial value
  progressBar.max = candles.length // Set maximum value to the total number of candles

  const totalChunks = Math.ceil(candles.length / chunkLength)
  let chunkIndex = 0

  // Start processing the first chunk
  processNextChunk()

  function processNextChunk() {
    drawBalanceGraph(accountBalanceHistory, false) // Update the balance graph
    const start = chunkIndex * chunkLength
    const end = Math.min((chunkIndex + 1) * chunkLength, candles.length)

    for (let i = start; i < end; i++) {
      candleIndex = i
      currentCandle = candles[i]
      executeLoop(backtestLogic, currentCandle.open)
      checkPendingOrders(currentCandle)
      closePositions(currentCandle)
    }

    // Update progress bar after processing each chunk
    progressBar.value = end
    chunkIndex++

    if (chunkIndex < totalChunks) {
      // If there are more chunks, schedule the next one after a delay
      setTimeout(processNextChunk, 0.1) // Use setTimeout to yield control
    } else {
      // Finished processing all chunks
      drawBalanceGraph(accountBalanceHistory, false) // Update the balance graph
      console.log('Backtest completed.')
    }
  }

  function executeLoop(backtestLogic, currentCandleOpenPrice) {
    eval(backtestLogic)
    loop()
  }
  function executeSetup(backtestLogic, currentCandleOpenPrice) {
    eval(backtestLogic)
    setup()
  }
}

// Function to check pending orders against current candle
function checkPendingOrders(candle) {
  for (let i = 0; i < pendingOrders.length; i++) {
    const order = pendingOrders[i]
    if (
      ((order.orderType === 'BuyLimit' || order.orderType === 'SellStop') &&
        order.executionPrice >= candle.low) ||
      ((order.orderType === 'SellLimit' || order.orderType === 'BuyStop') &&
        order.executionPrice <= candle.high)
    ) {
      let orderType
      if (order.orderType === 'SellLimit' || order.orderType === 'SellStop') {
        orderType = 'Sell'
      } else if (
        order.orderType === 'BuyLimit' ||
        order.orderType === 'BuyStop'
      ) {
        orderType = 'Buy'
      }

      const openPosition = {
        ticketNumber: order.ticketNumber,
        orderType: orderType,
        orderSize: order.orderSize,
        executionPrice: order.executionPrice,
        takeProfit: order.takeProfit,
        stopLoss: order.stopLoss,
        openTime: candle.dateTime,
        magicNumber: order.magicNumber,
      }
      openPositions.push(openPosition)
      pendingOrders.splice(i, 1)
      i--
      console.log(
        'Position opened: ',
        candleIndex,
        ' ',
        order.ticketNumber,
        ' ',
        orderType,
        ' ',
        order.orderSize,
        ' ',
        order.takeProfit,
        ' ',
        order.stopLoss,
        ' ',
        order.executionPrice
      )
    }
  }
}

// Function to close positions in profit or loss
function closePositions(candle) {
  for (let i = 0; i < openPositions.length; i++) {
    const position = openPositions[i]
    let closeTime = null
    let closePrice = null
    let profitLoss = 0
    let isAmbiguous = false

    // Check if both TP and SL are within the high and low of the candle
    if (
      position.takeProfit &&
      position.stopLoss &&
      ((position.orderType === 'Buy' &&
        position.takeProfit <= candle.high &&
        position.stopLoss >= candle.low) ||
        (position.orderType === 'Sell' &&
          position.takeProfit >= candle.low &&
          position.stopLoss <= candle.high))
    ) {
      closeTime = candle.dateTime
      isAmbiguous = true
    } else if (
      position.stopLoss &&
      ((position.orderType === 'Buy' && position.stopLoss >= candle.low) ||
        (position.orderType === 'Sell' && position.stopLoss <= candle.high))
    ) {
      closeTime = candle.dateTime
      closePrice = position.stopLoss
      profitLoss = calculateProfitLoss(
        position.orderType,
        position.orderSize,
        position.executionPrice,
        position.stopLoss
      )
    } else if (
      position.takeProfit &&
      ((position.orderType === 'Buy' && position.takeProfit <= candle.high) ||
        (position.orderType === 'Sell' && position.takeProfit >= candle.low))
    ) {
      closeTime = candle.dateTime
      closePrice = position.takeProfit
      profitLoss = calculateProfitLoss(
        position.orderType,
        position.orderSize,
        position.executionPrice,
        position.takeProfit
      )
    }

    // Close the position
    if (closeTime !== null) {
      const closedPosition = {
        ticketNumber: position.ticketNumber,
        orderType: position.orderType,
        orderSize: position.orderSize,
        executionPrice: position.executionPrice,
        takeProfit: position.takeProfit,
        stopLoss: position.stopLoss,
        openTime: position.openTime,
        closeTime: closeTime,
        closePrice: closePrice,
        profitLoss: profitLoss,
        magicNumber: position.magicNumber,
        isAmbiguous: isAmbiguous,
      }
      closedPositions.push(closedPosition)
      openPositions.splice(i, 1)
      i--
      console.log(
        'Position closed: ',
        candleIndex,
        ' ',
        position.ticketNumber,
        ' ',
        position.orderType,
        ' ',
        position.orderSize,
        ' ',
        position.takeProfit,
        ' ',
        position.stopLoss,
        ' ',
        closePrice,
        ' ',
        profitLoss
      )

      // Update total profit loss after closing positions
      accountBalance += closedPosition.profitLoss
      accountBalanceHistory.push(accountBalance) // Add the current balance to the history
    }
  }
}

function calculateProfitLoss(orderType, orderSize, openPrice, closePrice) {
  let profitLoss = 0
  if (orderType === 'Buy') {
    profitLoss = closePrice - openPrice
  } else if (orderType === 'Sell') {
    profitLoss = openPrice - closePrice
  }
  const totalProfitLoss =
    (orderSize / openPrice) *
    (profitLoss -
      spread -
      (openPrice * openCommission) / 100 -
      (closePrice * closeCommission) / 100)

  return totalProfitLoss
}

function drawBalanceGraph(data) {
  // Get the canvas element
  const canvas = document.getElementById('balanceGraph')

  // Clear the canvas
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Destroy the existing Chart instance if it exists
  if (myChart) {
    myChart.destroy()
  }

  // Determine the minimum and maximum values in the data
  const minValue = Math.min(...data)
  const maxValue = Math.max(...data)

  // Calculate padding for the y-axis range
  const padding = (maxValue - minValue) * 0.1 // 10% padding

  // Prepare data for Chart.js
  const chartData = {
    labels: Array.from({ length: data.length }, (_, i) => i + 1),
    datasets: [
      {
        label: 'Balance History',
        data: data,
        pointStyle: 'circle', // Set point style to circle
        radius: 0, // Set radius to 0 to render as dots
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1,
      },
    ],
  }

  // Create the chart using Chart.js
  myChart = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
        },
        y: {
          min: minValue - padding, // Adjusted minimum value
          max: maxValue + padding, // Adjusted maximum value
          beginAtZero: false, // Allow for negative values if present
        },
      },
      animation: {
        duration: 0, // Disable animation
      },
    },
  })
}

// Function to handle OrderSend command
function OrderSend(
  orderType,
  orderSize,
  executionPrice,
  takeProfit,
  stopLoss,
  magicNumber
) {
  if (
    orderType !== 'SellLimit' &&
    orderType !== 'BuyLimit' &&
    orderType !== 'SellStop' &&
    orderType !== 'BuyStop' &&
    orderType !== 'Sell' &&
    orderType !== 'Buy'
  ) {
    console.error(
      'Invalid order type. Order type must be SellLimit, BuyLimit, SellStop, BuyStop.'
    )
    return
  }

  if (orderType === 'SellLimit' && executionPrice < currentCandle.open) {
    console.error(
      'Invalid order open price. SellLimit open price must be higher than the candle open price.'
    )
    return
  }

  if (orderType === 'BuyLimit' && executionPrice > currentCandle.open) {
    console.error(
      'Invalid order open price. BuyLimit open price must be lower than the candle open.'
    )
    return
  }

  if (orderType === 'SellStop' && executionPrice > currentCandle.open) {
    console.error(
      'Invalid order open price. SellStop open price must be lower than the candle open.'
    )
    return
  }

  if (orderType === 'BuyStop' && executionPrice < currentCandle.open) {
    console.error(
      'Invalid order open price. BuyStop open price must be higher than the candle open.'
    )
    return
  }

  if (isNaN(orderSize) || isNaN(executionPrice) || isNaN(magicNumber)) {
    console.error(
      'Invalid order parameters. Order size, execution price, and magic number must be numeric.'
    )
    return
  }

  takeProfit = parseFloat(takeProfit)
  stopLoss = parseFloat(stopLoss)
  magicNumber = parseInt(magicNumber)
  const ticketNumber = generateTicketNumber()

  if (
    orderType === 'SellLimit' ||
    orderType === 'BuyLimit' ||
    orderType === 'SellStop' ||
    orderType === 'BuyStop'
  ) {
    const order = {
      ticketNumber: ticketNumber,
      orderType: orderType,
      orderSize: parseFloat(orderSize),
      executionPrice: parseFloat(executionPrice),
      takeProfit: takeProfit,
      stopLoss: stopLoss,
      magicNumber: magicNumber,
    }
    pendingOrders.push(order)
    console.log(
      'Order placed: ',
      candleIndex,
      ' ',
      order.ticketNumber,
      ' ',
      orderType,
      ' ',
      order.orderSize,
      ' ',
      order.takeProfit,
      ' ',
      order.stopLoss,
      ' ',
      order.executionPrice
    )
  }
  if (orderType === 'Sell' || orderType === 'Buy') {
    const openPosition = {
      ticketNumber: ticketNumber,
      orderType: orderType,
      orderSize: parseFloat(orderSize),
      executionPrice: currentCandle.open,
      takeProfit: takeProfit,
      stopLoss: stopLoss,
      openTime: currentCandle.dateTime,
      magicNumber: magicNumber,
    }
    openPositions.push(openPosition)
    console.log(
      'Position opened: ',
      candleIndex,
      ' ',
      openPosition.ticketNumber,
      ' ',
      openPosition.orderType,
      ' ',
      openPosition.orderSize,
      ' ',
      openPosition.takeProfit,
      ' ',
      openPosition.stopLoss,
      ' ',
      openPosition.executionPrice
    )
  }
}

function generateTicketNumber() {
  const ticketNumber = ticketCounter
  ticketCounter++ // Increment ticket counter for next order
  return ticketNumber
}

// Function to modify take profit and stop loss of an order or position
function ModifyOrderTPSL(ticketNumber, newTakeProfit, newStopLoss) {
  const orderIndex = pendingOrders.findIndex(
    (order) => order.ticketNumber === ticketNumber
  )
  const positionIndex = openPositions.findIndex(
    (position) => position.ticketNumber === ticketNumber
  )

  // If the order or position is found, update its take profit and stop loss
  if (orderIndex !== -1) {
    pendingOrders[orderIndex].takeProfit = newTakeProfit
    pendingOrders[orderIndex].stopLoss = newStopLoss
    console.log(
      'Take profit and stop loss modified: ',
      candleIndex,
      ' ',
      pendingOrders[orderIndex].ticketNumber,
      ' ',
      pendingOrders[orderIndex].orderType,
      ' ',
      pendingOrders[orderIndex].orderSize,
      ' ',
      pendingOrders[orderIndex].takeProfit,
      ' ',
      pendingOrders[orderIndex].stopLoss
    )
  } else if (positionIndex !== -1) {
    openPositions[positionIndex].takeProfit = newTakeProfit
    openPositions[positionIndex].stopLoss = newStopLoss
    console.log(
      'Take profit and stop loss modified: ',
      candleIndex,
      ' ',
      openPositions[positionIndex].ticketNumber,
      ' ',
      openPositions[positionIndex].orderType,
      ' ',
      openPositions[positionIndex].orderSize,
      ' ',
      openPositions[positionIndex].takeProfit,
      ' ',
      openPositions[positionIndex].stopLoss
    )
  } else {
    console.error(
      `Order or position with ticket number ${ticketNumber} not found.`
    )
  }
}

// Function to cancel open orders by ticket number
function CancelOrder(ticketNumber) {
  const orderIndex = pendingOrders.findIndex(
    (order) => order.ticketNumber === ticketNumber
  )

  if (orderIndex !== -1) {
    const canceledOrder = pendingOrders[orderIndex]
    canceledOrders.push(canceledOrder)
    pendingOrders.splice(orderIndex, 1)
    console.log(`Order canceled: Ticket ${ticketNumber}`)
  } else {
    console.error(`Order with ticket number ${ticketNumber} not found.`)
  }
}

// Function to search for positions or orders based on type and status
function SearchOrdersByTypeAndStatus(orderType, status) {
  let results = []

  if (status === 'StillOpen') {
    // Search in pending orders and open positions
    results.push(
      ...pendingOrders.filter((order) => order.orderType === orderType)
    )
    results.push(
      ...openPositions.filter((position) => position.orderType === orderType)
    )
  } else if (status === 'AlreadyClosed') {
    // Search in closed positions and canceled orders
    results.push(
      ...closedPositions.filter((position) => position.orderType === orderType)
    )
    results.push(
      ...canceledOrders.filter((order) => order.orderType === orderType)
    )
  }

  return results
}

// Function to search for the last open position or order based on type
function GetLastOpenOrder(orderType) {
  let lastOpenOrder = null

  // If orderType is BuyLimit or SellLimit, search in pending orders
  if (
    orderType === 'BuyLimit' ||
    orderType === 'SellLimit' ||
    orderType === 'BuyStop' ||
    orderType === 'SellStop'
  ) {
    const pendingOrdersFiltered = pendingOrders.filter(
      (order) => order.orderType === orderType
    )
    if (pendingOrdersFiltered.length > 0) {
      pendingOrdersFiltered.sort((a, b) => b.openTime - a.openTime)
      lastOpenOrder = pendingOrdersFiltered[0]
    }
  }
  // If orderType is Buy or Sell, search in open positions
  else if (orderType === 'Buy' || orderType === 'Sell') {
    const openPositionsFiltered = openPositions.filter(
      (position) => position.orderType === orderType
    )
    if (openPositionsFiltered.length > 0) {
      openPositionsFiltered.sort((a, b) => b.openTime - a.openTime)
      lastOpenOrder = openPositionsFiltered[0]
    }
  }

  return lastOpenOrder
}

// Function to search for the last closed position or canceled order based on type
function GetLastClosedOrder(orderType) {
  let lastClosedOrder = null

  // If orderType is BuyLimit or SellLimit, search in canceled orders
  if (
    orderType === 'BuyLimit' ||
    orderType === 'SellLimit' ||
    orderType === 'BuyStop' ||
    orderType === 'SellStop'
  ) {
    const canceledOrdersFiltered = canceledOrders.filter(
      (order) => order.orderType === orderType
    )
    if (canceledOrdersFiltered.length > 0) {
      canceledOrdersFiltered.sort((a, b) => b.closeTime - a.closeTime)
      lastClosedOrder = canceledOrdersFiltered[0]
    }
  }
  // If orderType is Buy or Sell, search in closed positions
  else if (orderType === 'Buy' || orderType === 'Sell') {
    const closedPositionsFiltered = closedPositions.filter(
      (position) => position.orderType === orderType
    )
    if (closedPositionsFiltered.length > 0) {
      closedPositionsFiltered.sort((a, b) => b.closeTime - a.closeTime)
      lastClosedOrder = closedPositionsFiltered[0]
    }
  }

  return lastClosedOrder
}

// Define the MovingAverage function
function MovingAverage(period, offset) {
  let sum = 0

  // Calculate the sum of opening prices for the specified period
  for (let i = candleIndex - offset; i > candleIndex - offset - period; i--) {
    if (i >= 0) {
      sum += candles[i].open
    } else {
      break // Break the loop if we reach the beginning of the candles array
    }
  }

  // Calculate the average
  const average = sum / Math.min(period, candleIndex - offset + 1)

  return average
}

function setSampleBackTestLogic() {
  const initialCode = `
  //The trading algorithm code should be written in JavaScript.
  
  //The open price of current candle
  const openPrice = currentCandleOpenPrice

  //global variables of trading system
  const orderSize = 1000 //in quote currency (e.g. it's 1000$ in BTC/USD)
  const stopLoss = 1000 //in quote currency (e.g. 1000$ decrease in BTC/USD price for a buy position)
  const takeProfit = 1000 //in quote currency (e.g. 1000$ increase in BTC/USD price for a buy position)

  //setup() is a necessary function which provides initial settings of the account and broker
  function setup() {
    //Account and broker settings (spread, openCommission, closeCommission, and initialAccountBalance) must be set here
    spread = 0 // e.g. 0.0001 for EUR/USD
    openCommission = 0.05 //percentage of order size taken by broker for opening a position (e.g. 0.05%)
    closeCommission = 0.05 //percentage of order size taken by broker for closing a position (e.g. 0.05%)
    initialAccountBalance = 1000 //in quote currency (e.g. 1000$ initial balance)
  }

  //loop() is a necessary function which executes the main trading code for each candle in provided market data
  function loop() {
    //Main code of the trading algorithm mut be written here
    placeOrder() //an example code
  }

  //any customs functions defined in setup() and loop() routines should be written here

  //an example code
  function placeOrder() {
    if (
      GetLastOpenOrder('BuyLimit') === null &&
      GetLastOpenOrder('BuyStop') === null &&
      GetLastOpenOrder('Buy') === null &&
      GetLastOpenOrder('SellLimit') === null &&
      GetLastOpenOrder('SellStop') === null &&
      GetLastOpenOrder('Sell') === null
    ) {
      //const randomNumber = Math.floor(Math.random() * 2)
      const maPeriod = 10 * 24 * 60
      const maCandleIndex0 = 0
      const maCandleIndex1 = 60
      const SMAValue0 = MovingAverage(maPeriod, maCandleIndex0)
      const SMAValue1 = MovingAverage(maPeriod, maCandleIndex1)

      if (SMAValue0 - SMAValue1 > 0) {
        OrderSend('BuyStop', orderSize, openPrice, openPrice + takeProfit, openPrice - stopLoss, 1111)
      } else if (SMAValue0 - SMAValue1 < 0) {
        OrderSend('SellStop', orderSize, openPrice, openPrice - takeProfit, openPrice + stopLoss, 1111)
      }
    }
  }
  `
  editor.setValue(initialCode)
}
