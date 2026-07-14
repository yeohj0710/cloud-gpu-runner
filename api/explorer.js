import { isAuthorized } from "../lib/auth.js";
import { bcs, cloud } from "../lib/kakao-cloud.js";
import { ncp } from "../lib/ncp-cloud.js";

const catalog = {
  kakao_instances:{provider:"kakao",label:"BCS 인스턴스",service:"bcs",path:"instances?limit=100"},
  kakao_gpu_flavors:{provider:"kakao",label:"GPU 사양",service:"bcs",path:"flavors?instance_type=gpu&limit=100"},
  kakao_keypairs:{provider:"kakao",label:"SSH 키페어",service:"bcs",path:"keypairs?limit=100"},
  kakao_images:{provider:"kakao",label:"VM 이미지",service:"image",path:"images?instance_type=vm&image_type=basic&limit=100"},
  kakao_vpcs:{provider:"kakao",label:"VPC 네트워크",service:"vpc",path:"vpcs?limit=100"},
  kakao_subnets:{provider:"kakao",label:"서브넷",service:"vpc",path:"subnets?limit=100"},
  ncp_regions:{provider:"naver",label:"리전",path:"/vserver/v2/getRegionList?responseFormatType=json"},
  ncp_servers:{provider:"naver",label:"서버 인스턴스",path:"/vserver/v2/getServerInstanceList?responseFormatType=json"},
  ncp_products:{provider:"naver",label:"서버 상품",path:"/vserver/v2/getServerProductList?responseFormatType=json"},
  ncp_login_keys:{provider:"naver",label:"로그인 키",path:"/vserver/v2/getLoginKeyList?responseFormatType=json"},
  ncp_public_ips:{provider:"naver",label:"공인 IP",path:"/vserver/v2/getPublicIpInstanceList?responseFormatType=json"},
  ncp_block_storage:{provider:"naver",label:"블록 스토리지",path:"/vserver/v2/getBlockStorageInstanceList?responseFormatType=json"},
};
export default async function handler(req,res){
  if(!await isAuthorized(new Request("https://work-memory/api/explorer",{headers:{cookie:req.headers.cookie||""}})))return res.status(401).json({error:"unauthorized"});
  try{if(req.method==="GET"&&!req.query?.id)return res.json({ok:true,items:Object.entries(catalog).map(([id,x])=>({id,...x,path:undefined,service:undefined})),notice:"조회 API는 직접 사용료 0원입니다. 조회된 자원 자체의 요금은 별도입니다."});const item=catalog[String(req.query?.id||req.body?.id||"")];if(!item)return res.status(400).json({error:"unsupported_operation"});let data;if(item.provider==="kakao")data=item.service==="bcs"?await bcs(item.path):await cloud(item.service,item.path);else data=await ncp(item.path);return res.json({ok:true,operation:item.label,provider:item.provider,estimated_api_cost:0,currency:"KRW",data});}catch(error){return res.status(502).json({error:error.message||"explorer_failed"});}}
