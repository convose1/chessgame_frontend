import { Player } from "@/App";
import socket from "@/socekt";
import { Chess, Move } from "chess.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { Button } from "./ui/button";

interface GameProps {
  players: Player[];
  room: string;
  cleanup: () => void;
  currentPlayerId: string | null;
}

const formatTime = (time: number) => {
  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
};

const Game: React.FC<GameProps> = ({ players, room, currentPlayerId }) => {
  const chess = useMemo(() => new Chess(), []);
  const [fen, setFen] = useState<string>(chess.fen());
  const [over, setOver] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [elapsedTime, setElapsedTime] = useState<number>(0); // State to track elapsed time
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(
    null
  );
  const [playAgainRequested, setPlayAgainRequested] = useState<boolean>(false);
  const [playAgainReceived, setPlayAgainReceived] = useState<boolean>(false);
  const [boardWidth, setBoardWidth] = useState<number>(600);

  const currentPlayerColour = players.find(
    (player) => player.id === currentPlayerId
  )?.orientation;

  const opponent = players.find(
    (player) => player.id !== currentPlayerId
  )?.username;
  const avatar = players.find(
    (player) => player.id === currentPlayerId
  )?.avatar;

  const startTimer = () => {
    const interval = setInterval(() => {
      setElapsedTime((prevTime) => prevTime + 1);
    }, 1000);
    setTimerInterval(interval);
  };

  // Stop the timer
  const stopTimer = useCallback(() => {
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  }, [timerInterval]);
  // Reset the timer
  const resetTimer = () => {
    stopTimer();
    setElapsedTime(0);
    startTimer();
  };

  useEffect(() => {
    startTimer();
    return () => stopTimer();
  }, [stopTimer]);

  const makeAMove = useCallback(
    (move: { from: string; to: string; promotion?: string }): Move | null => {
      try {
        const result = chess.move(move);
        if (result) {
          setFen(chess.fen());
          setError("");

          if (chess.isGameOver()) {
            if (chess.isCheckmate()) {
              stopTimer();
              setOver(
                `Checkmate! ${chess.turn() === "w" ? "black" : "white"} wins!`
              );
            } else if (chess.isDraw()) {
              setOver("Draw");
            } else {
              setOver("Game over");
            }
          }
        } else {
          setError("Invalid move. Please try again.");
        }
        return result;
      } catch (error) {
        console.error(error);
        setError("Invalid move. Please try again.");
        return null;
      }
    },
    [chess]
  );

  function onDrop(sourceSquare: string, targetSquare: string) {
    if (!currentPlayerColour) return false;
    const playerTurn = currentPlayerColour === "white" ? "w" : "b";

    if (chess.turn() !== playerTurn) {
      setError("It's not your turn!");
      return false;
    }

    const moveData = {
      from: sourceSquare,
      to: targetSquare,
      promotion: "q",
    };

    const move = makeAMove(moveData);

    if (move) {
      socket.emit("move", { move: moveData, room });
    }

    return !!move;
  }

  useEffect(() => {
    const handleMove = (moveData: {
      from: string;
      to: string;
      promotion?: string;
    }) => {
      makeAMove(moveData);
    };

    socket.on("move", handleMove);

    return () => {
      socket.off("move", handleMove);
    };
  }, [makeAMove]);

  const handlePlayAgainRequest = () => {
    socket.emit("requestPlayAgain", { room });
    setPlayAgainRequested(true);
  };

  const handlePlayAgainAccept = () => {
    socket.emit("acceptPlayAgain", { room });
  };

  useEffect(() => {
    const handlePlayAgainRequestReceived = () => {
      setPlayAgainReceived(true);
    };

    const handlePlayAgainAccepted = () => {
      setPlayAgainRequested(false);
      setPlayAgainReceived(false);
      chess.reset();
      setFen(chess.fen());
      setError("");
      setOver("");
      resetTimer();
    };

    socket.on("playAgainRequest", handlePlayAgainRequestReceived);
    socket.on("playAgainAccepted", handlePlayAgainAccepted);

    return () => {
      socket.off("playAgainRequest", handlePlayAgainRequestReceived);
      socket.off("playAgainAccepted", handlePlayAgainAccepted);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chess]);

  useEffect(() => {
    const handleResize = () => {
      // setBoardWidth(window.innerWidth);
      if (window.innerWidth > 1024) {
        setBoardWidth(800);
      } else if (window.innerWidth > 768) {
        setBoardWidth(700);
      } else {
        setBoardWidth(600);
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      <div className="flex items-center flex-col  justify-center  h-full w-full gap-10">
        <div className="flex flex-col lg:flex-row items-center gap-6 justify-center">
          <div className="flex flex-col items-start self-start w-full gap-6">
            <div className="flex  items-center gap-3">
              <img
                src={avatar}
                alt="Avatar"
                className="w-12 h-12 lg:size-16 rounded-full"
              />
              <p className="text-2xl lg:text-4xl font-semibold">{opponent}</p>
            </div>
            <p className="text-2xl font-semibold hidden lg:block">
              {chess.turn() === "w" ? "White" : "Black"}'s turn
            </p>
            <p className="text-xl font-semibold mt-2">
              Game Duration: {formatTime(elapsedTime)}
            </p>
          </div>
          <div className="" style={{ aspectRatio: "1/1" }}>
            <Chessboard
              position={fen}
              onPieceDrop={onDrop}
              boardOrientation={currentPlayerColour}
              customBoardStyle={{
                borderRadius: "10px",
                boxShadow:
                  "0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)",
              }}
              boardWidth={boardWidth}
            />
          </div>
          <div className="flex flex-col items-center text-center">
            <p className="text-2xl font-semibold lg:hidden">
              {chess.turn() === "w" ? "White" : "Black"}'s turn
            </p>
            <p className="text-xl font-semibold mt-2 lg:hidden">
              Game Duration: {formatTime(elapsedTime)}
            </p>
            {error && <p className="text-red-500">{error}</p>}
            {over && <p className="text-green-500">{over}</p>}
          </div>
        </div>
      </div>
      {over && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg text-center space-y-4">
            <h2 className="text-3xl font-bold mb-4">Game Over</h2>
            <p className="text-lg">Thanks for playing!</p>
            {playAgainRequested ? (
              <p className="text-lg">Waiting for {opponent}...</p>
            ) : playAgainReceived ? (
              <Button
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
                onClick={handlePlayAgainAccept}
              >
                Accept Rematch
              </Button>
            ) : (
              <Button
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                onClick={handlePlayAgainRequest}
              >
                Request Rematch
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Game;
