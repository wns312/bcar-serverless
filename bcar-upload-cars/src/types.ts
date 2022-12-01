import { envs } from './configs'

export type RangeChunk = {
  start: number,
  end: number
}

export type Environments = typeof envs

export interface CarBase {
  name: string
  dataValue: string
  index: number
}

export type CarCategory = Map<string, CarManufacturer>

export interface CarManufacturer extends CarBase {
  carModelMap: Map<string, CarModel>
}

export interface CarModel extends CarBase {
  carSegment: string
  detailModels: CarDetailModel[] | null

}

export interface CarDetailModel extends CarBase {
}

export interface CarSegment {
  name: string
  value: string
  index: number
}
