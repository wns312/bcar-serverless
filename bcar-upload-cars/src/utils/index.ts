import { PutRequest } from "@aws-sdk/client-dynamodb";
import { CarManufacturer, CarDataObject, CarSegment, RangeChunk, ManufacturerOrigin } from "../types"
import { AttributeValue } from "@aws-sdk/client-dynamodb"
export function chunk<T>(arr: T[], size: number): T[][] {
  return arr.reduce<T[][]>(
    (a, item) => {
      if (a[a.length - 1].length === size) {
        a.push([item]);
      } else {
        a[a.length - 1].push(item);
      }

      return a;
    },
    [[]]
  );
}

export function rangeChunk(size: number, chunkSize: number) {
  const rangeChunks: RangeChunk[] = []
  for (let i = 1; i < size + 1; i = i + chunkSize) {
    rangeChunks.push({
      start: i,
      end: Math.min(i+chunkSize, size)
    })
  }
  return rangeChunks
}

// Delay를 간편하게 주기위한 용도
export async function delay(delay: number) {
  await new Promise((resolve, reject)=>{
    setTimeout(()=>{ resolve(null) }, delay)
  })
}

export class CategoryFormatter {
  constructor(){}

  createSegmentForm(segmentMap: Map<string, CarSegment>) {
    return Array.from(segmentMap.keys()).map(k =>{
      const segObj = segmentMap.get(k)
      return {
        Item: {
          PK: { S: `#SEGMENT-${segObj!.name}` },
          SK: { S: `#SEGMENT-${segObj!.name}` },
          name: { S: segObj!.name },
          value: { S: segObj!.value },
          index: { N: segObj!.index.toString() },
        }
      }
    })
  }

  createManufacturerForm(companyMap: Map<string, CarManufacturer>) {
    return Array.from(companyMap.keys()).map(k =>{
      const companyObj = companyMap.get(k)
      return {
        Item: {
          PK: { S: `#COMPANY-${companyObj!.name}` },
          SK: { S: `#COMPANY-${companyObj!.name}` },
          name: { S: companyObj!.name },
          value: { S: companyObj!.dataValue },
          index: { N: companyObj!.index.toString() },
          origin: { S : companyObj!.origin }
        }
      }
    })
  }

  createCarModelForm(companyMap: Map<string, CarManufacturer>) {
    const companyKeys = Array.from(companyMap.keys())
    const carModelList: PutRequest[] = []

    companyKeys.reduce((map, key)=> {
      const companyObj = companyMap.get(key)
      const carModelMap = companyObj?.carModelMap
      const carModelKeys = Array.from(carModelMap!.keys())
      carModelKeys.forEach(k => {
        if (!companyObj || !carModelMap) {
          console.error(companyObj);
          console.error(carModelMap);
          throw new Error("there is no proper companyObj or carModelMap");
        }
        map.push({
          Item: {
            PK: { S: `#MODEL-${carModelMap!.get(k)!.name}` },
            SK: { S: `#COMPANY-${companyObj!.name}` },
            segment: { S: carModelMap!.get(k)!.carSegment },
            company: { S: companyObj!.name },
            modelAmount: { N: carModelMap!.get(k)!.detailModels!.length.toString() },
            name: { S: k },
            value: { S: carModelMap!.get(k)!.dataValue },
            index: { N: carModelMap!.get(k)!.index.toString() },
          }
        })
      })
      return map
    }, carModelList)

    return carModelList
  }

  createCarDetailModelForm(companyMap: Map<string, CarManufacturer>) {
    const companyKeys = Array.from(companyMap.keys())
    const carDetailModelList: PutRequest[] = []

    companyKeys.reduce((map, key)=> {
      const company = companyMap.get(key)
      if (!company) {
        console.error(key);
        throw new Error("there is no proper company");
      }
      const carModelMap = company.carModelMap
      const carModelKeys = Array.from(carModelMap!.keys())
      carModelKeys.forEach(k => {
        const carModel = carModelMap.get(k)

        if (!carModel) {
          console.error(carModel);
          throw new Error("there is no carModel");

        }
        const carDetailModels = carModel.detailModels
        if (!carDetailModels) {
          console.error({
              carDetailModels,
              key: k
            });
          return
        }

        carDetailModels!.forEach(carDetail => {
          map.push({
            Item: {
              PK: { S: `#DETAIL-${carDetail.name}`},
              SK: { S: `#MODEL-${carModel.name}`},
              segment: { S: carModel.carSegment },
              company: { S: company!.name },
              name: { S: carDetail.name },
              value: { S: carDetail.dataValue },
              index: { N: carDetail.index.toString() },
            }
          })
        })

      })

      return map
    }, carDetailModelList)

    return carDetailModelList
  }

}

export class CarObjectFormatter {

  createCarObject(items: Record<string, AttributeValue>[]): CarDataObject[] {
    return items.map(item=>{
      return {
        PK: item.PK.S!,
        SK: item.SK.S!,
        carCheckSrc: item.CarCheckSrc.S!,
        modelYear: item.ModelYear.S!,
        presentationsDate: item.PresentationsDate.S!,
        displacement: item.Displacement.S!,
        mileage: item.Mileage.S!,
        carImgList: item.CarImgList ? item.CarImgList.SS! : [],
        hasMortgage: item.HasMortgage.BOOL!,
        hasSeizure: item.HasSeizure.BOOL!,
        title: item.Title.S!,
        fuelType: item.FuelType.S!,
        carNumber: item.CarNumber.S!,
        registerNumber: item.RegisterNumber.S!,
        presentationNumber: item.PresentationNumber.S!,
        price: Number.parseInt(item.Price.N!),
        hasAccident: item.HasAccident.S!,
        gearBox: item.GearBox.S!,
        color: item.Color.S!,
        company: item.Company.S!,
        category: item.Category.S!,
      }
    })
  }
}

export const categoryConvertor = new Map<string, string>([
  ["", "중대형"], // 카테고리가 없는 차량은 중대형으로 그냥 넣어버린다.
  ["대형차", "중대형"],
  ["중형차", "중대형"],
  ["경차", "경소형"],
  ["소형차", "경소형"],
  ["준중형차", "준중형"],
  ["승합차", "승합"],
  ["화물차", "화물/버스"],
  ["버스", "화물/버스"],
  ["특장차", "화물/버스"],
  ["RV", "SUV/RV"],
  ["SUV", "SUV/RV"],
  ["스포츠카", "스포츠카"],
])

export const companyConvertor = new Map<string, {name: string,origin: ManufacturerOrigin}>([
  // 기본차량 - 국내
  ["기아", {name: "기아", origin: ManufacturerOrigin.Domestic}],
  ["현대", {name: "현대", origin: ManufacturerOrigin.Domestic}],
  ["쌍용", {name: "쌍용", origin: ManufacturerOrigin.Domestic}],
  ["삼성", {name: "삼성", origin: ManufacturerOrigin.Domestic}],
  ["쉐보레(대우)", {name: "쉐보레(대우)", origin: ManufacturerOrigin.Domestic}],
  // 기본차량 - 수입
  ["렉서스", {name: "렉서스", origin: ManufacturerOrigin.Imported}],
  ["벤츠", {name: "벤츠", origin: ManufacturerOrigin.Imported}],
  ["아우디", {name: "아우디", origin: ManufacturerOrigin.Imported}],
  ["미니", {name: "미니", origin: ManufacturerOrigin.Imported}],
  ["테슬라", {name: "테슬라", origin: ManufacturerOrigin.Imported}],
  ["포드", {name: "포드", origin: ManufacturerOrigin.Imported}],
  ["캐딜락", {name: "캐딜락", origin: ManufacturerOrigin.Imported}],
  ["푸조", {name: "푸조", origin: ManufacturerOrigin.Imported}],
  ["지프", {name: "지프", origin: ManufacturerOrigin.Imported}],
  ["포르쉐", {name: "포르쉐", origin: ManufacturerOrigin.Imported}],
  ["혼다", {name: "혼다", origin: ManufacturerOrigin.Imported}],
  ["링컨", {name: "링컨", origin: ManufacturerOrigin.Imported}],
  ["도요타", {name: "도요타", origin: ManufacturerOrigin.Imported}],
  ["벤틀리", {name: "벤틀리", origin: ManufacturerOrigin.Imported}],
  ["BMW", {name: "BMW", origin: ManufacturerOrigin.Imported}],
  ["크라이슬러", {name: "크라이슬러", origin: ManufacturerOrigin.Imported}],
  ["랜드로버", {name: "랜드로버", origin: ManufacturerOrigin.Imported}],
  ["닛산", {name: "닛산", origin: ManufacturerOrigin.Imported}],
  ["볼보", {name: "볼보", origin: ManufacturerOrigin.Imported}],
  ["폭스바겐", {name: "폭스바겐", origin: ManufacturerOrigin.Imported}],
  ["인피니티", {name: "인피니티", origin: ManufacturerOrigin.Imported}],
  // 추가차량 - 국내
  ["르노(삼성)", {name: "삼성", origin: ManufacturerOrigin.Domestic}],
  ["쉐보레", {name: "쉐보레(대우)", origin: ManufacturerOrigin.Domestic}],
  ["대창모터스", {name: "기타", origin: ManufacturerOrigin.Domestic}],
  ["대우버스", {name: "기타", origin: ManufacturerOrigin.Domestic}],
  ["세보모빌리티(캠시스)", {name: "기타", origin: ManufacturerOrigin.Domestic}],
  ["한국상용트럭", {name: "기타", origin: ManufacturerOrigin.Domestic}],
  // 추가차량 - 수입
  ["토요타", {name: "도요타", origin: ManufacturerOrigin.Imported}],
  ["재규어", {name: "기타", origin: ManufacturerOrigin.Imported}],
  ["시트로엥", {name: "기타", origin: ManufacturerOrigin.Imported}],
  ["미쯔비시", {name: "기타", origin: ManufacturerOrigin.Imported}],
  ["피아트", {name: "기타", origin: ManufacturerOrigin.Imported}],
  ["북기은상", {name: "기타", origin: ManufacturerOrigin.Imported}],
  ["다이하쯔", {name: "기타", origin: ManufacturerOrigin.Imported}],
  ["스마트", {name: "기타", origin: ManufacturerOrigin.Imported}],
  ["타타대우", {name: "기타", origin: ManufacturerOrigin.Imported}],
  ["스바루", {name: "기타", origin: ManufacturerOrigin.Imported}],
  ["마세라티", {name: "기타", origin: ManufacturerOrigin.Imported}],
  ["스즈키", {name: "기타", origin: ManufacturerOrigin.Imported}],
  ["사브", {name: "기타", origin: ManufacturerOrigin.Imported}],
  ["닷지", {name: "기타", origin: ManufacturerOrigin.Imported}],
  ["쯔더우(쎄미시스코)", {name: "기타", origin: ManufacturerOrigin.Imported}],
  ["DFSK(동풍자동차)", {name: "기타", origin: ManufacturerOrigin.Imported}],
  ["만트럭", {name: "기타", origin: ManufacturerOrigin.Imported}],
  ["포톤", {name: "기타", origin: ManufacturerOrigin.Imported}],
])

export const modelDetailConverter = new Map<string, string>([
  ["봉고III", "봉고Ⅲ"],
  ["더뉴봉고III", "더 뉴봉고Ⅲ"],
  ["봉고IIIEV", "봉고ⅢEV"],
  ["올뉴모닝JA", "올뉴모닝(JA)"],
  ["캡처", "캡쳐"],
])
