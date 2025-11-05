const ws = require("ws");

const server = new ws.WebSocketServer({ port: 8080 }, () => {
  console.log("Servidor iniciado en el puerto 8080");
});

let jugadores = new Map(); // conexion -> datos del jugador
let siguienteId = 0;

let fruta = null; // fruta actual

// Función para generar fruta fuera de los jugadores
function generarFruta() {
  let posx, posy;
  let colisiones;
  do {
    colisiones = false;
    posx = Math.floor(Math.random() * 485); // 500 - 15
    posy = Math.floor(Math.random() * 485);
    // comprobar colisión con jugadores
    jugadores.forEach(d => {
      if (
        posx < d.posx + 20 &&
        posx + 15 > d.posx &&
        posy < d.posy + 20 &&
        posy + 15 > d.posy
      ) {
        colisiones = true;
      }
    });
  } while (colisiones);

  const colores = ["green", "blue", "purple"];
  fruta = {
    id: Date.now(), // id único
    posx,
    posy,
    color: colores[Math.floor(Math.random() * colores.length)],
  };

  // avisar a todos los jugadores
  jugadores.forEach((d, c) => {
    c.send(JSON.stringify({ tipo: "fruta", datos: fruta }));
  });
}

// Generar la primera fruta al inicio
generarFruta();

server.on("connection", conexionJugador => {
  console.log("Alguien se ha conectado");

  // Crear nuevo jugador
  const datos = {
    id: siguienteId,
    posx: Math.floor(Math.random() * 480),
    posy: Math.floor(Math.random() * 480),
    dir: "0",
    score: 0
  };
  siguienteId++;
  jugadores.set(conexionJugador, datos);

  // Avisar a todos del nuevo jugador
  jugadores.forEach((d, c) => {
    c.send(JSON.stringify({ tipo: "new", datos }));
  });

  // Avisar al nuevo jugador de los existentes
  jugadores.forEach((d, c) => {
    if (c !== conexionJugador) {
      conexionJugador.send(JSON.stringify({ tipo: "new", datos: d }));
    }
  });

  // Mandar la fruta actual al jugador nuevo
  if (fruta) {
    conexionJugador.send(JSON.stringify({ tipo: "fruta", datos: fruta }));
  }

  conexionJugador.on("message", m => {
    const mensaje = JSON.parse(m.toString());

    if (mensaje.tipo === "mover") {
      const jugador = jugadores.get(conexionJugador);
      jugador.posx = mensaje.datos.posx;
      jugador.posy = mensaje.datos.posy;
      jugador.dir = mensaje.datos.dir;

      // comprobar si come la fruta
      if (fruta) {
        const px = jugador.posx;
        const py = jugador.posy;
        if (
          px < fruta.posx + 15 &&
          px + 20 > fruta.posx &&
          py < fruta.posy + 15 &&
          py + 20 > fruta.posy
        ) {
          jugador.score += 1;

          // avisar a todos que se borró la fruta
          jugadores.forEach((d, c) => {
            c.send(JSON.stringify({ tipo: "borrarFruta", datos: fruta.id }));
            c.send(JSON.stringify({ tipo: "score", datos: jugador }));
          });

          // generar nueva fruta
          generarFruta();
        }
      }

      // mandar movimiento a todos
      jugadores.forEach((d, c) => {
        c.send(JSON.stringify({ tipo: "mover", datos: jugador }));
      });
    }
  });

  conexionJugador.on("close", () => {
    const datosDisconectPlayer = jugadores.get(conexionJugador);
    jugadores.delete(conexionJugador);
    jugadores.forEach((d, c) => {
      c.send(JSON.stringify({ tipo: "delete", datos: datosDisconectPlayer.id }));
    });
  });
});

