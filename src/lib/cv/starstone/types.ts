import type { CvMat } from '../types';
import type { StarstoneTemplateId } from './atlas.generated';

export type StarstoneTemplateMat = CvMat;

export interface StarstoneAtlasStore {
  readonly atlas: CvMat;
  get(id: StarstoneTemplateId): StarstoneTemplateMat;
  dispose(): void;
}
