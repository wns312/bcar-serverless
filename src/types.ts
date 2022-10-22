

import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { envs } from './configs'


export type RangeChunk = {
  start: number,
  end: number
}

export type BCarListEventInput = {
  startPage: number;
  endPage: number;
}

export type BCarDetailEventInput = {
  manageNums: number[]
}

export type Environments = typeof envs

export type CarListObject = {
  carNum: string;
  detailPageNum: number;
  price: number;
};

export type CarInfoMap = {
  Category: string;
  Displacement: string;
  CarNumber: string;
  ModelYear: string;
  Mileage: string;
  Color: string;
  GearBox: string;
  FuelType: string;
  PresentationNumber: string;
  HasAccident: string;
  RegisterNumber: string;
  PresentationsDate: string;
  HasSeizure: boolean;
  HasMortgage: boolean;
};


export type BatchCreateCarInput = {
  PK: AttributeValue
  SK: AttributeValue
  Category: AttributeValue
  Displacement: AttributeValue
  CarNumber: AttributeValue
  ModelYear: AttributeValue
  Mileage: AttributeValue
  Color: AttributeValue
  GearBox: AttributeValue
  FuelType: AttributeValue
  PresentationNumber: AttributeValue
  HasAccident: AttributeValue
  RegisterNumber: AttributeValue
  PresentationsDate: AttributeValue
  HasSeizure: AttributeValue
  HasMortgage: AttributeValue
  CarCheckSrc: AttributeValue
  CarImgList?: AttributeValue
};

export type DBCarListObject = {
  items: Record<string, AttributeValue>[],
  count: number
}

export type CarDetailObject = {
  carInfoMap: {
    [k: string]: string | boolean
  },
  carCheckSrc: string,
  carImgList: string[] | null
}
