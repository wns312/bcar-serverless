import { envs } from './configs'

export type Environments = typeof envs

export type RangeChunk = {
  start: number,
  end: number
}

export type Account = {
  id: string
  pw: string
  isTestAccount: boolean
  isErrorOccured: boolean
  logStreamUrl: string | null
  errorContent: string | null
}

export type CarCategory = Map<string, CarManufacturer>

export interface CarBase {
  name: string
  dataValue: string
  index: number
}

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
