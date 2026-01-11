import { useRef, useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";

interface Obstacle {
  x: number;
  type: "needle" | "bottle";
  width: number;
  height: number;
}

type GameState = "idle" | "playing" | "gameover";

export function RocRunnerGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  
  const [gameState, setGameState] = useState<GameState>("idle");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem("rocRunnerHighScore");
    return saved ? parseInt(saved, 10) : 0;
  });

  const gameRef = useRef({
    playerY: 0,
    playerVelocity: 0,
    isJumping: false,
    isDucking: false,
    obstacles: [] as Obstacle[],
    frameCount: 0,
    groundY: 0,
    playerHeight: 40,
    playerWidth: 35,
    speed: 5,
    score: 0,
  });

  const drawMountain = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    isDucking: boolean
  ) => {
    const actualHeight = isDucking ? height * 0.5 : height;
    const actualY = isDucking ? y + height * 0.5 : y;
    
    ctx.save();
    
    ctx.beginPath();
    ctx.moveTo(x, actualY + actualHeight);
    ctx.lineTo(x + width / 2, actualY);
    ctx.lineTo(x + width, actualY + actualHeight);
    ctx.closePath();
    
    const gradient = ctx.createLinearGradient(x, actualY, x, actualY + actualHeight);
    gradient.addColorStop(0, "hsl(285, 35%, 58%)");
    gradient.addColorStop(1, "hsl(285, 35%, 38%)");
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    const innerOffset = width * 0.15;
    ctx.beginPath();
    ctx.moveTo(x + innerOffset, actualY + actualHeight - 2);
    ctx.lineTo(x + width / 2, actualY + actualHeight * 0.35);
    ctx.lineTo(x + width - innerOffset, actualY + actualHeight - 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.restore();
  }, []);

  const drawNeedle = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    ctx.save();
    
    const bodyWidth = width * 0.3;
    const bodyHeight = height * 0.4;
    const bodyX = x + (width - bodyWidth) / 2;
    const bodyY = y + height - bodyHeight;
    
    ctx.fillStyle = "hsl(285, 25%, 45%)";
    ctx.fillRect(bodyX, bodyY, bodyWidth, bodyHeight);
    
    ctx.beginPath();
    ctx.moveTo(x + width / 2, y);
    ctx.lineTo(bodyX, bodyY);
    ctx.lineTo(bodyX + bodyWidth, bodyY);
    ctx.closePath();
    ctx.fillStyle = "#9ca3af";
    ctx.fill();
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 1;
    ctx.stroke();
    
    ctx.restore();
  }, []);

  const drawBottle = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number
  ) => {
    ctx.save();
    
    const bodyWidth = width * 0.7;
    const bodyHeight = height * 0.6;
    const bodyX = x + (width - bodyWidth) / 2;
    const bodyY = y + height - bodyHeight;
    
    ctx.beginPath();
    ctx.roundRect(bodyX, bodyY, bodyWidth, bodyHeight, 3);
    const gradient = ctx.createLinearGradient(bodyX, bodyY, bodyX + bodyWidth, bodyY);
    gradient.addColorStop(0, "#854d0e");
    gradient.addColorStop(0.5, "#a16207");
    gradient.addColorStop(1, "#854d0e");
    ctx.fillStyle = gradient;
    ctx.fill();
    
    const neckWidth = width * 0.25;
    const neckHeight = height * 0.35;
    const neckX = x + (width - neckWidth) / 2;
    const neckY = y + height * 0.05;
    
    ctx.fillStyle = "#854d0e";
    ctx.fillRect(neckX, neckY, neckWidth, neckHeight);
    
    const capWidth = neckWidth * 1.3;
    const capHeight = height * 0.08;
    const capX = x + (width - capWidth) / 2;
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(capX, neckY, capWidth, capHeight);
    
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(bodyX + bodyWidth * 0.15, bodyY + bodyHeight * 0.1, bodyWidth * 0.15, bodyHeight * 0.6);
    
    ctx.restore();
  }, []);

  const resetGame = useCallback(() => {
    const game = gameRef.current;
    game.playerY = game.groundY;
    game.playerVelocity = 0;
    game.isJumping = false;
    game.isDucking = false;
    game.obstacles = [];
    game.frameCount = 0;
    game.speed = 5;
    game.score = 0;
    setScore(0);
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    setGameState("playing");
  }, [resetGame]);

  const endGame = useCallback(() => {
    const finalScore = gameRef.current.score;
    setGameState("gameover");
    if (finalScore > highScore) {
      setHighScore(finalScore);
      localStorage.setItem("rocRunnerHighScore", finalScore.toString());
    }
  }, [highScore]);

  useEffect(() => {
    if (gameState !== "playing") return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      gameRef.current.groundY = canvas.height - 60;
      gameRef.current.playerY = gameRef.current.groundY;
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const game = gameRef.current;
    const gravity = 0.8;
    const jumpForce = -14;
    let animationId: number;

    const gameLoop = () => {
      if (gameState !== "playing") return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const groundGradient = ctx.createLinearGradient(0, game.groundY + game.playerHeight, 0, canvas.height);
      groundGradient.addColorStop(0, "hsl(285, 35%, 48%)");
      groundGradient.addColorStop(1, "hsl(285, 35%, 38%)");
      ctx.fillStyle = groundGradient;
      ctx.fillRect(0, game.groundY + game.playerHeight, canvas.width, canvas.height - game.groundY - game.playerHeight);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, game.groundY + game.playerHeight);
      ctx.lineTo(canvas.width, game.groundY + game.playerHeight);
      ctx.stroke();

      if (game.isJumping || game.playerY < game.groundY) {
        game.playerVelocity += gravity;
        game.playerY += game.playerVelocity;

        if (game.playerY >= game.groundY) {
          game.playerY = game.groundY;
          game.playerVelocity = 0;
          game.isJumping = false;
        }
      }

      const playerX = 60;
      const playerDrawY = game.playerY;
      drawMountain(ctx, playerX, playerDrawY, game.playerWidth, game.playerHeight, game.isDucking);

      game.frameCount++;
      
      const spawnInterval = Math.max(70, 150 - Math.floor(game.score / 10));
      if (game.frameCount % spawnInterval === 0) {
        const type = Math.random() > 0.5 ? "needle" : "bottle";
        const obstacle: Obstacle = {
          x: canvas.width,
          type,
          width: type === "needle" ? 20 : 25,
          height: type === "needle" ? 45 : 40,
        };
        game.obstacles.push(obstacle);
      }

      game.obstacles = game.obstacles.filter(obs => {
        obs.x -= game.speed;
        
        const obsY = game.groundY + game.playerHeight - obs.height;
        
        if (obs.type === "needle") {
          drawNeedle(ctx, obs.x, obsY, obs.width, obs.height);
        } else {
          drawBottle(ctx, obs.x, obsY, obs.width, obs.height);
        }

        const playerActualHeight = game.isDucking ? game.playerHeight * 0.5 : game.playerHeight;
        const playerActualY = game.isDucking ? game.playerY + game.playerHeight * 0.5 : game.playerY;
        
        const playerBox = {
          x: playerX + 5,
          y: playerActualY + 5,
          width: game.playerWidth - 10,
          height: playerActualHeight - 10,
        };
        
        const obsBox = {
          x: obs.x + 3,
          y: obsY + 3,
          width: obs.width - 6,
          height: obs.height - 6,
        };

        if (
          playerBox.x < obsBox.x + obsBox.width &&
          playerBox.x + playerBox.width > obsBox.x &&
          playerBox.y < obsBox.y + obsBox.height &&
          playerBox.y + playerBox.height > obsBox.y
        ) {
          endGame();
          return false;
        }

        if (obs.x + obs.width < playerX && !("scored" in obs)) {
          game.score++;
          setScore(game.score);
          (obs as Obstacle & { scored: boolean }).scored = true;
        }

        return obs.x > -obs.width;
      });

      game.speed = 5 + Math.floor(game.score / 20) * 0.5;

      ctx.fillStyle = "white";
      ctx.font = "bold 16px system-ui";
      ctx.textAlign = "right";
      ctx.fillText(`${t('game.score')}: ${game.score}`, canvas.width - 20, 30);

      animationId = requestAnimationFrame(gameLoop);
    };

    animationId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [gameState, drawMountain, drawNeedle, drawBottle, endGame, t]);

  useEffect(() => {
    if (gameState !== "playing") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        const game = gameRef.current;
        if (!game.isJumping && game.playerY >= game.groundY) {
          game.isJumping = true;
          game.playerVelocity = -14;
        }
      }
      if (e.code === "ArrowDown") {
        e.preventDefault();
        gameRef.current.isDucking = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowDown") {
        gameRef.current.isDucking = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameState]);

  const handleTouchStart = useCallback(() => {
    if (gameState !== "playing") return;
    const game = gameRef.current;
    if (!game.isJumping && game.playerY >= game.groundY) {
      game.isJumping = true;
      game.playerVelocity = -14;
    }
  }, [gameState]);

  return (
    <div className="w-full py-4 px-4">
      <div 
        ref={containerRef}
        className="relative w-full h-[120px] md:h-[150px] max-w-4xl mx-auto rounded-xl overflow-hidden bg-gradient-to-b from-transparent to-primary/20 border border-white/20 shadow-lg"
        data-testid="game-container"
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          onTouchStart={handleTouchStart}
        />

        {gameState === "idle" && (
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center bg-primary/30 backdrop-blur-sm cursor-pointer"
            onClick={startGame}
            data-testid="game-start-overlay"
          >
            <Button 
              variant="outline" 
              size="lg" 
              className="gap-2 bg-white/90 hover:bg-white text-primary border-white"
              data-testid="button-start-game"
            >
              <Play className="w-5 h-5" />
              {t('game.clickToPlay')}
            </Button>
            <p className="text-white/80 text-sm mt-2 text-center px-4">
              {t('game.instructions')}
            </p>
          </div>
        )}

        {gameState === "gameover" && (
          <div 
            className="absolute inset-0 flex flex-col items-center justify-center bg-primary/50 backdrop-blur-sm"
            data-testid="game-over-overlay"
          >
            <p className="text-white font-bold text-xl mb-1">{t('game.gameOver')}</p>
            <p className="text-white/90 text-sm mb-1">
              {t('game.score')}: {score} | {t('game.highScore')}: {highScore}
            </p>
            <Button 
              variant="outline" 
              size="sm"
              className="gap-2 bg-white/90 hover:bg-white text-primary border-white mt-2"
              onClick={startGame}
              data-testid="button-restart-game"
            >
              <RotateCcw className="w-4 h-4" />
              {t('game.playAgain')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
