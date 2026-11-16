export {
  PRODUCT_ITEM,
  type SaleCreateRequest,
  type SalesDetailRequest,
  type SaleUpdateRequest,
  type SaleVoidRequest,
  SERVICE_ITEM,
} from '../../schemas/sale.schema'
export {
  bookingToHold,
  planSaleChange,
  refusalOfChange,
  refusalOfVoid,
  type SaleChangePlan,
  type SaleChangeReferences,
  type SaleChangeRefusal,
  type SaleVoidRefusal,
} from './_shared/change'
export type { SaleUseCaseDependencies } from './_shared/dependencies'
export {
  type BookingOfSale,
  planSale,
  type SaleOrigin,
  type SalePlan,
  type SaleReferences,
  type SalonOfSale,
} from './_shared/plan'
export { saleNumberFrom } from './_shared/sale-number'
export { CreateSaleUseCase } from './create-sale.usecase'
export { GetSaleUseCase } from './get-sale.usecase'
export { ListSalesUseCase, type SalePage } from './list-sales.usecase'
export { UpdateSaleUseCase } from './update-sale.usecase'
export { VoidSaleUseCase } from './void-sale.usecase'
