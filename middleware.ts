import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
 
// 登入頁
const isSignInPage = createRouteMatcher(["/auth"]);

// 如果之後有真正的「公開頁面」再慢慢加進來
// 先假設：除了 /auth 以外，全部都是受保護頁面
// 所以這裡暫時不需要 isProtectedRoute 了
// const isProtectedRoute = createRouteMatcher(["/product(.*)"]);
 
export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const isAuth = await convexAuth.isAuthenticated();

  // ✅ 已登入又在 /auth → 導回預設首頁（現在用 /product）
  if (isSignInPage(request) && isAuth) {
    return nextjsMiddlewareRedirect(request, "/product");
  }

  // ✅ 沒登入、又不是 /auth → 一律導到 /auth
  if (!isSignInPage(request) && !isAuth) {
    return nextjsMiddlewareRedirect(request, "/auth");
  }

  // 其他情況照常通過
  //（已登入 + 非 /auth，或 沒登入 + /auth）
});
 
export const config = {
  // The following matcher runs middleware on all routes
  // except static assets.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};