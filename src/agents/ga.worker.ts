// Roda o algoritmo genético fora da thread principal, para a tela não travar durante o treino.
import { train, type TrainingOptions } from './genetic';

self.onmessage = (e: MessageEvent<TrainingOptions>) => {
  for (const report of train(e.data)) self.postMessage({ type: 'generation', report });
  self.postMessage({ type: 'done' });
};
