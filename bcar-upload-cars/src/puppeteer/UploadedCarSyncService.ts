// import { mkdir, rm } from "fs/promises"
// import { AttributeValue } from "@aws-sdk/client-dynamodb"
import { BrowserInitializer } from "."
import { DynamoClient, DynamoUploadedCarClient } from "../db/dynamo"
import { AccountSheetClient } from "../sheet"
// import { CarDetailModel, CarModel, CarSegment, CarManufacturer, ManufacturerOrigin } from "../types"

export class UploadedCarSyncService {

  constructor(
    private dynamoCarClient: DynamoClient,
    private dynamoUploadedCarClient: DynamoUploadedCarClient,
    private accountSheetClient: AccountSheetClient,
    private initializer: BrowserInitializer,
  ) {}

  private async getExistingUpdatedCarMap() {
    const [carResults, updatedCarResults] = await Promise.all([
      this.dynamoCarClient.getAllCars(10),
      this.dynamoUploadedCarClient.scanUpdatedCars(10)
    ])
    // 변환을 먼저 해주어야 한다? 아니야 존재 확인만 하면 됨
    const carResultMap = carResults.items.reduce((map, item)=>
      map.set(item.PK.S!, item.Title.S!),
      new Map<string, string>()
    )
    // 차량이 판매중인 애들만 남긴 것
    const updatedCarResultMap = updatedCarResults.items.reduce((map, item)=>{
        return carResultMap.get(item.SK.S!) ? map.set(item.SK.S!, item.PK.S!) : map
      },
      new Map<string, string>()
    )
    console.log(carResultMap);
    console.log(updatedCarResultMap);
    return Array.from(updatedCarResultMap.entries()).reduce((map, [car, user])=>{
      let carList = map.get(user)
      return map.set(user, carList ? [...carList, car]: [car])
    }, new Map<string, string[]>())
  }

  async execute() {
    const [userCarMap, users] = await Promise.all([
      this.getExistingUpdatedCarMap(),
      this.accountSheetClient.getAccounts(),
    ])
    const userIds = Array.from(userCarMap.keys()).map(userPk=>userPk.replace('#USER-', ''))
    const filteredUsers = users.filter(user=>userIds.includes(user.id))
    console.log(userIds);
    console.log(filteredUsers);
    // 0. CarSynchronizer 클래스 새로 생성하고 의존성 주입할 것
    // 1. 해당 id 목록으로 각 id에 로그인
    // 2. 차량 목록 페이지로 갈 것
    // 3. 차량 목록에 해당하지 않는 차량을 확인하고 삭제할 것 (아마도 뒷 페이지부터 작업하는게 편리할 것)
    // 4. update목록에서 삭제된 목록을 updatedCars 목록에서 제거할 것
  }
}
