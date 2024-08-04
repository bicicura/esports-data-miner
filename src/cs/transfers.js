import fetch from "node-fetch";
// para parsear html
import cheerio from "cheerio";

// Función para hacer una pausa para cumplir con los TS de Liquipedia
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchExpandedTransfersPage() {
  // extraer data de la url
  const url = "https://liquipedia.net/counterstrike/api.php";

  // GET params
  const params = new URLSearchParams({
    action: "expandtemplates",
    format: "json",
    text: "{{Portal:Transfers}}",
    prop: "wikitext",
  });

  // options / headers del request
  const options = {
    headers: {
      "User-Agent":
        "EsportsDataMiner/1.0 (esportsdataminer@esportsdataminer.com)",
      "Accept-Encoding": "gzip",
    },
  };

  try {
    const response = await fetch(`${url}?${params.toString()}`, options);
    await delay(2000); // Esperar 2 segundos para respetar el límite de solicitudes
    const data = await response.json();
    return data.expandtemplates.wikitext; // obtengo HTML de la pagina de Transfers
  } catch (error) {
    console.error("Error fetching expanded transfers page:", error);
  }
}

// obtengo los transfers del raw HTML
function extractTransfers(html) {
  const $ = cheerio.load(html);
  const transfers = [];

  $(".divRow").each((i, element) => {
    const date = $(element).find(".divCell.Date").text().trim();
    const player = $(element).find(".divCell.Name").text().trim();
    const oldTeam = $(element).find(".divCell.Team.OldTeam").text().trim();
    const newTeam = $(element).find(".divCell.Team.NewTeam").text().trim();

    // Extraer el href del div con la clase 'divCell Ref'
    const refDiv = $(element).find(".divCell.Ref").text().trim(); // Usamos text() para obtener solo el texto
    let href = null;
    const hrefMatch = refDiv.match(/https?:\/\/[^\s\]]+/);
    if (hrefMatch) {
      href = hrefMatch[0];
    }

    if (date && player && oldTeam && newTeam) {
      transfers.push({ date, player, oldTeam, newTeam, ref: href });
    }
  });

  return transfers;
}

// sanitizo los datos de los Players
const getPlayersData = (transfers) => {
  return transfers.map(({ player, ...transfer }) => {
    if (!player) {
      return {
        ...transfer,
        players: null,
      };
    }

    const countryMatches = [player.matchAll(/px\|([^|]+)\|link=Category:/g)];
    const playerMatches = [player.matchAll(/\[\[(\w+)\|(\w+)\]\]/g)];

    const countries = countryMatches.map((match) => match[1]);
    const playerNames = playerMatches.map((match) => match[2]);

    const players = playerNames.map((name, index) => ({
      country: countries[index] || null,
      name: name,
    }));

    return {
      ...transfer,
      players,
    };
  });
};

const getOldTeamData = (transfers) => {
  return transfers.map(({ oldTeam, ...restTransfer }) => {
    if (!oldTeam) {
      return restTransfer;
    }
    if (oldTeam === "None") {
      return {
        ...restTransfer,
        oldTeam: { name: oldTeam, status: null },
      };
    }

    const oldTeamStringSplit = oldTeam.split("|");
    const oldTeamLastFragment =
      oldTeamStringSplit[oldTeamStringSplit.length - 1];
    const oldTeamName = oldTeamStringSplit[3];

    let oldNameStatus = null;

    if (oldTeamLastFragment.charAt(oldTeamLastFragment.length - 1) === ")") {
      const startIndex = oldTeamLastFragment.lastIndexOf("(");
      const endIndex = oldTeamLastFragment.lastIndexOf(")");

      if (startIndex && endIndex) {
        oldNameStatus = oldTeamLastFragment.substring(startIndex + 1, endIndex);
      }
    }

    return {
      ...restTransfer,
      oldTeam: {
        name: oldTeamName,
        status: oldNameStatus,
      },
    };
  });
};

const getNewTeamData = (transfers) => {
  return transfers.map(({ newTeam, ...restTransfer }) => {
    if (!newTeam) {
      return restTransfer;
    }
    if (newTeam === "None") {
      return {
        ...restTransfer,
        newTeam: { name: newTeam, status: null },
      };
    }

    const newTeamStringSplit = newTeam.split("|");
    const newTeamLastFragment =
      newTeamStringSplit[newTeamStringSplit.length - 1];
    const newTeamName = newTeamStringSplit[3];

    let newNameStatus = null;

    if (newTeamLastFragment.charAt(newTeamLastFragment.length - 1) === ")") {
      const startIndex = newTeamLastFragment.lastIndexOf("(");
      const endIndex = newTeamLastFragment.lastIndexOf(")");

      if (startIndex && endIndex) {
        newNameStatus = newTeamLastFragment.substring(startIndex + 1, endIndex);
      }
    }

    return {
      ...restTransfer,
      newTeam: {
        name: newTeamName,
        status: newNameStatus,
      },
    };
  });
};

const filterByDate = (transfers) => {
  return transfers.filter((transfer) => transfer.date === "2024-08-02");
};

fetchExpandedTransfersPage().then((html) => {
  const transfers = extractTransfers(html);
  const transfersFromToday = filterByDate(transfers);
  const sanitizedTransfers = getNewTeamData(
    getOldTeamData(getPlayersData(transfersFromToday))
  );
  console.log(sanitizedTransfers);
  return sanitizedTransfers;
});
