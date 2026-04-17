export interface ParRMSE {
  score_ml: number;
  y_true: 0 | 1;
}

export interface ResultadoRMSE {
  /** RMSE rounded to 4 decimal places, or null when samples are insufficient. */
  rmse: number | null;
  n_amostras: number;
  nota?: string;
}

export function calcularRMSE(pares: ParRMSE[]): ResultadoRMSE {
  if (pares.length === 0) {
    return { rmse: null, n_amostras: 0 };
  }

  if (pares.length < 5) {
    return { rmse: null, n_amostras: pares.length, nota: "amostras_insuficientes" };
  }

  const invalid = pares.find(({ score_ml }) => score_ml < 0 || score_ml > 1);
  if (invalid) {
    throw new RangeError(`score_ml must be in [0,1], received ${invalid.score_ml}`);
  }

  const sumSquaredErrors = pares.reduce(
    (acc, { score_ml, y_true }) => acc + (score_ml - y_true) ** 2,
    0
  );
  const rmse = parseFloat(
    Math.sqrt(sumSquaredErrors / pares.length).toFixed(4)
  );

  return { rmse, n_amostras: pares.length };
}
