# Algorithmic Trading Backtest System

## Introduction

This project provides a simple backtesting system for algorithmic trading strategies using JavaScript. It allows users to upload market data in CSV format and write their trading logic using provided functions. The system simulates trading based on the provided strategy and generates balance history for analysis.

## Usage

### Getting Started

1. Clone or download the project repository.
2. Open the `index.html` file in a web browser.

### Uploading Market Data

- The market data should be provided in a CSV format.
- Each row should represent a single candle.
- The format of each row should be: `date and time (unix timestamp), open, high, low, close`.
- Example: `1715264700, 60000.01, 60500.15, 59500.40, 60200.33`

### Writing Trading Logic

- Use the provided code editor to write your trading algorithm in JavaScript.
- The `setup()` function is necessary and executed only once at the beginning.
- The `loop()` function is necessary and executed for each candle in the market data.
- Initial account and broker settings must be defined inside `setup()` function.
- The trading logic must be written inside `loop()` function.

Traders have access to current candle data as following:

- `currentCandle.open`: Represents the opening price of current candle.
- `currentCandle.dateTime`: Represents the opening datetime of current candle.

### Available Functions

#### 1. `OrderSend(orderType, orderSize, executionPrice, takeProfit, stopLoss, magicNumber)`

Sends a trading order.

- `orderType`: Type of order (BuyLimit, SellLimit, BuyStop, SellStop, Buy, Sell).
- `orderSize`: Size of the order.
- `executionPrice`: Price at which the order will be executed.
- `takeProfit`: Take profit level.
- `stopLoss`: Stop loss level.
- `magicNumber`: Unique identifier for the order.
  **Example:**
  ```javascript
  OrderSend('BuyStop', 1000, 60000.0, 60500.0, 59500.0, 12345)
  ```

#### 2.`ModifyOrderTPSL(ticketNumber, newTakeProfit, newStopLoss)`

Modifies the take profit and stop loss levels of an order.

- `ticketNumber`: Ticket number of the order to be modified.
- `newTakeProfit`: New take profit level.
- `newStopLoss`: New stop loss level.
  **Example:**

```javascript
ModifyOrderTPSL(12345, 61000.0, 59000.0)
```

#### 3. `CancelOrder(ticketNumber)`

Cancels an open order.

- `ticketNumber`: Ticket number of the order to be canceled.
  **Example:**
  ```javascript
  CancelOrder(12345)
  ```

#### 4. `SearchOrdersByTypeAndStatus(orderType, status)`

Searches for orders or positions based on type and status.

- `orderType`: Type of order (BuyLimit, SellLimit, BuyStop, SellStop, Buy, Sell).
- `status`: Status of the orders (StillOpen, AlreadyClosed).
  **Example:**
  ```javascript
  const openOrders = SearchOrdersByTypeAndStatus('Buy', 'StillOpen')
  ```

#### 5. `GetLastOpenOrder(orderType)`

Retrieves the last open order of a specific type.

- `orderType`: Type of order (BuyLimit, SellLimit, BuyStop, SellStop, Buy, Sell).
  **Example:**
  ```javascript
  const lastOpenOrder = GetLastOpenOrder('SellLimit')
  ```

#### 6. `GetLastClosedOrder(orderType)`

Retrieves the last closed order of a specific type.

- `orderType`: Type of order (BuyLimit, SellLimit, BuyStop, SellStop, Buy, Sell).
  **Example:**
  ```javascript
  const lastClosedOrder = GetLastClosedOrder('Buy')
  ```

#### 7. `MovingAverage(period, offset)`

Calculates the moving average of the specified period.

- `period`: Number of candles to consider for the moving average.
- `offset`: Offset from the current candle index.
  **Example:**
  ```javascript
  const maValue = MovingAverage(10, 0)
  ```

#### 8. `FindPeaks(halfWindowSize, numberOfCandles)`

Finds peaks in the price data within a specified window.

- `halfWindowSize`: Half of the size of the window to consider for peak detection.
- `numberOfCandles`: Number of candles to analyze for peak detection.
  **Example:**
  ```javascript
  const peaks = FindPeaks(5, 20)
  ```

#### 9. `FindValleys(halfWindowSize, numberOfCandles)`

Finds valleys in the price data within a specified window.

- `halfWindowSize`: Half of the size of the window to consider for valley detection.
- `numberOfCandles`: Number of candles to analyze for valley detection.
  **Example:**
  ```javascript
  const peaks = FindValleys(5, 20)
  ```
