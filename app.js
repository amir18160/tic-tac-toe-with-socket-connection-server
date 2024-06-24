const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const dotenv = require("dotenv");

// to use environmet variable
dotenv.config();

// express app
const app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// websocket
const expressWs = require("express-ws")(app);

// game logic
const board = Array(9).fill(null);
const playerSymbol = "X";
const serverSymbol = "O";

const winningCombinations = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function isBoardFull() {
  return !board.includes(null);
}
function serverChoice() {
  if (board[4] === null) {
    board[4] = serverSymbol;
    return;
  }

  let randomNumber = Math.floor(Math.random() * 9);
  while (board[randomNumber] !== null) {
    randomNumber = Math.floor(Math.random() * 9);
  }

  board[randomNumber] = serverSymbol;
}
function userChoice(choice) {
  if (choice > 8 || choice < 0) {
    return "fail";
  }

  if (board[choice] !== null) {
    return "fail";
  }

  board[choice] = playerSymbol;
  return "success";
}
function reset() {
  board.forEach((data, index) => {
    board[index] = null;
  });
}

function didSomeoneWon() {
  let a;
  let b;
  let c;

  for (const combination of winningCombinations) {
    [a, b, c] = combination;
    if (board[a] === "X" && board[b] === "X" && board[c] === "X") {
      return [true, "PLAYER"];
    }

    if (board[a] === "O" && board[b] === "O" && board[c] === "O") {
      return [true, "COMPUTER"];
    }
  }

  const BoardFull = isBoardFull();
  if (!BoardFull) {
    return [false, "STILL_GOING"];
  }

  if (BoardFull) {
    return [true, "DRAW"];
  }
}

app.ws("/", (ws, req) => {
  // connection is open
  ws.send(JSON.stringify({ board, type: "start" }));

  ws.on("close", () => {
    reset();
  });

  ws.on("message", (msg) => {
    const { message, type } = JSON.parse(msg);

    // server response  object to user
    const resObject = { message: "", type: "", winner: "", board };

    if (type === "reset") {
      reset();
      resObject.type = "reset";
      resObject.message = "the game was reset";
      ws.send(JSON.stringify(resObject));
      return;
    }

    if (type === "choice") {
      const choiceResult = userChoice(message);

      //  if user choice is invalid ask for another choice
      if (choiceResult === "fail") {
        resObject.message = "invalid input! choose again...";
        resObject.type = "fail";
        ws.send(JSON.stringify(resObject));
        return;
      }

      //  check if the game is over after user choice
      let [isGameOver, winner] = didSomeoneWon();
      if (isGameOver) {
        resObject.type = "gameOver";
        resObject.message = "game is over!";
        resObject.winner = winner;
        resObject.board = board;
        ws.send(JSON.stringify(resObject));
        return;
      }

      // get server choice
      serverChoice();

      // check if the game is over after server choice
      [isGameOver, winner] = didSomeoneWon();
      if (isGameOver) {
        resObject.type = "gameOver";
        resObject.message = "game is over!";
        resObject.winner = winner;
        resObject.board = board;
        ws.send(JSON.stringify(resObject));
        return;
      }

      resObject.type = "playerChoice";
      resObject.message = "waiting for player choice";
      resObject.board = board;
      ws.send(JSON.stringify(resObject));
    }
  });
});

// catch 404 and forward to error handler
app.use((req, res, next) => {
  next(createError(404));
});

// error handler
app.use((err, req, res, next) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

// listen for events
const defaultPort = process.env.PORT;

app.listen(defaultPort, () =>
  console.log(`Server is running on port ${defaultPort}`)
);
