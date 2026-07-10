import React, { memo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Clock, Heart, BadgePercent, Timer, Bookmark } from "lucide-react";
import { Card, CardContent } from "@food/components/ui/card";
import { Button } from "@food/components/ui/button";
import { RestaurantGridSkeleton, LoadingSkeletonRegion } from "@food/components/ui/loading-skeletons";
import { getRestaurantAvailabilityStatus } from "@food/utils/restaurantAvailability";
import RestaurantImageCarousel from "./RestaurantImageCarousel";
import { diningAPI, restaurantAPI } from "@food/api";

// Module-level prefetch cache — shared with RestaurantDetails via window
const PREFETCH_CACHE_KEY = "__food_restaurant_prefetch_cache__";
if (!window[PREFETCH_CACHE_KEY]) window[PREFETCH_CACHE_KEY] = new Map();
export const restaurantPrefetchCache = window[PREFETCH_CACHE_KEY];

const prefetchingSet = new Set(); // Track in-flight prefetches to avoid duplicate calls

const prefetchRestaurant = async (slug) => {
  if (!slug || restaurantPrefetchCache.has(slug) || prefetchingSet.has(slug)) return;
  prefetchingSet.add(slug);
  try {
    const res = await diningAPI.getRestaurantBySlug(slug);
    if (res?.data?.success && res?.data?.data) {
      restaurantPrefetchCache.set(slug, res.data.data);
      return;
    }
  } catch { /* silent */ }
  try {
    const res = await restaurantAPI.getRestaurantById(slug);
    if (res?.data?.success && res?.data?.data) {
      restaurantPrefetchCache.set(slug, res.data.data);
    }
  } catch { /* silent */ } finally {
    prefetchingSet.delete(slug);
  }
};

const FoodRestaurantCard = memo(({ 
  restaurant, 
  index, 
  isOutOfService, 
  currentDate,
  isFavorite, 
  onFavoriteToggle, 
  backendOrigin 
}) => {
  const nameStr = typeof restaurant?.name === "string" ? restaurant.name.trim() : "";
  const fallbackSlugSource =
    nameStr ||
    (typeof restaurant?.restaurantName === "string" ? restaurant.restaurantName.trim() : "") ||
    String(restaurant?.slug || restaurant?.id || restaurant?._id || `restaurant-${index}`);

  const restaurantSlug =
    typeof restaurant?.slug === "string" && restaurant.slug.trim()
      ? restaurant.slug.trim()
      : (restaurant?.id || restaurant?._id || fallbackSlugSource.toLowerCase().replace(/\s+/g, "-"));

  const availability = getRestaurantAvailabilityStatus(restaurant, currentDate, {
    ignoreOperationalStatus: false,
  });
  const favorite = isFavorite(restaurantSlug);

  return (
    <div
      key={restaurant?.id || restaurant?._id || restaurantSlug || index}
      className="h-full transform transition-all duration-300 hover:-translate-y-3 hover:scale-[1.02]"
      style={{
        perspective: 1000,
        animation: index < 10 ? `fade-in-up 0.5s ease-out ${index * 0.05}s backwards` : "none",
      }}
    >
      <div className="h-full group">
        <Link
          to={`/user/restaurants/${restaurantSlug}`}
          className="flex h-full"
          onMouseEnter={() => prefetchRestaurant(restaurantSlug)}
          onTouchStart={() => prefetchRestaurant(restaurantSlug)}
        >
          <Card
            className={`relative flex h-full w-full flex-col gap-0 overflow-hidden rounded-[28px] border-0 border-background bg-white py-0 shadow-sm transition-all duration-500 hover:shadow-xl dark:border-gray-800 dark:bg-[#1a1a1a] ${
              !availability.isOpen ? "grayscale opacity-75" : ""
            }`}
          >
            <div className="relative">
              <RestaurantImageCarousel
                restaurant={restaurant}
                priority={index < 3}
                backendOrigin={backendOrigin}
              />

              {restaurant.featuredDish && (
                <div className="absolute left-3 top-3 z-10 flex items-center transform transition-transform duration-300 group-hover:scale-105">
                  <div className="flex items-center rounded-full bg-black/80 px-3 py-1 text-[11px] font-bold tracking-tight text-white shadow-xl backdrop-blur-md">
                    {restaurant.featuredDish} {restaurant.featuredPrice ? `• ₹${restaurant.featuredPrice}` : ""}
                  </div>
                </div>
              )}

              <div className="absolute right-3 top-3 z-10 transform transition-transform duration-300 group-hover:scale-110">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onFavoriteToggle(event, restaurant, restaurantSlug, favorite);
                  }}
                  aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
                  className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full shadow-lg transition-all duration-300 ${
                    favorite
                      ? "bg-red-500 text-white"
                      : "bg-white/90 text-gray-800 backdrop-blur-sm hover:bg-white"
                  }`}
                >
                  <Bookmark className={`h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300 ${favorite ? "fill-white" : ""}`} />
                </Button>
              </div>
              
              <div className="absolute right-3 bottom-3 z-10 transform transition-transform duration-300 group-hover:scale-110">
                <div
                  className={`flex-shrink-0 rounded-[8px] px-2 py-0.5 text-white shadow-md ${
                    Number(restaurant.rating) > 0 ? "bg-[#10b981]" : "bg-gray-400"
                  } flex items-center gap-1`}
                >
                  <span className="text-[11px] font-bold tracking-tight">
                    {Number(restaurant.rating) > 0 ? Number(restaurant.rating).toFixed(1) : "NEW"}
                  </span>
                  {Number(restaurant.rating) > 0 && (
                    <Star className="h-3 w-3 fill-white text-white" strokeWidth={0} />
                  )}
                </div>
              </div>
            </div>

            <div className="transform transition-transform duration-300 group-hover:-translate-y-1">
              <CardContent className="flex flex-grow flex-col p-3 sm:p-4">
                <div className="mb-2 lg:mb-3">
                  <h3 className="line-clamp-1 text-lg font-bold leading-tight tracking-tight text-[#1c1c1e] transition-colors duration-300 group-hover:text-[#FE5502] dark:text-white">
                    {restaurant.name}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-[4px] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-sm ${
                        availability.isOpen ? "bg-[#10b981] text-white" : "bg-gray-400 text-white"
                      }`}
                    >
                      {availability.isOpen ? "Open now" : "Offline"}
                    </span>
                    {availability.isOpen && availability.closingCountdownLabel && (
                      <div className="flex items-center gap-1 rounded-[4px] border border-orange-100 bg-orange-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-orange-500">
                        <Timer className="h-3 w-3 flex-shrink-0" strokeWidth={2.5} />
                        <span>{availability.closingCountdownLabel}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-2 flex items-center gap-1 text-sm text-gray-500 opacity-70 transition-opacity duration-300 group-hover:opacity-100 lg:mb-3 lg:text-base">
                  <Clock className="h-4 w-4 text-gray-500 dark:text-gray-400 lg:h-5 lg:w-5" strokeWidth={1.5} />
                  <span className="font-medium text-gray-700 dark:text-gray-300">{restaurant.deliveryTime}</span>
                  <span className="mx-1">|</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{restaurant.distance}</span>
                </div>

                {restaurant.offer && (
                  <div className="mt-auto flex items-center gap-2 text-sm transition-transform duration-300 group-hover:translate-x-1 lg:text-base">
                    <BadgePercent className="h-4 w-4 text-black lg:h-5 lg:w-5" strokeWidth={2} />
                    <span className="font-medium text-gray-700 dark:text-gray-300">{restaurant.offer}</span>
                  </div>
                )}
              </CardContent>
            </div>

            <div className="pointer-events-none absolute inset-0 z-0 rounded-md border border-transparent transition-all duration-300 group-hover:border-[#FE5502]/30 group-hover:shadow-[inset_0_0_0_1px_rgba(204,37,50,0.2)]" />
          </Card>
        </Link>
      </div>
    </div>
  );
});

const RestaurantGrid = memo(({
  filteredRestaurants,
  visibleRestaurants,
  showRestaurantSkeleton,
  isLoadingFilterResults,
  loadingRestaurants,
  isOutOfService,
  availabilityTick,
  isFavorite,
  onFavoriteToggle,
  backendOrigin,
  hasMoreRestaurants,
  loadMoreRestaurants,
}) => {
  // Pre-compute Date object once per tick to avoid N new Date() calls inside card renders
  const currentDate = React.useMemo(() => new Date(availabilityTick), [availabilityTick]);

  return (
    <section className="content-auto space-y-0 pb-8 pt-3 sm:pt-4 md:pb-10 lg:pt-6">
      <div className="mb-4 px-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-[#9ca3af]">
            {filteredRestaurants.length} Restaurants Delivering to You
          </h2>
          <span className="text-[15px] font-bold text-[#1c1c1e]">Featured</span>
        </div>
      </div>
      
      <div className={`relative ${showRestaurantSkeleton ? "min-h-[360px] sm:min-h-[420px]" : ""}`}>
        <AnimatePresence>
          {showRestaurantSkeleton && (
            <motion.div
              className="absolute inset-0 z-10 rounded-lg bg-white/94 dark:bg-[#1a1a1a]/94"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <LoadingSkeletonRegion label="Loading restaurants" className="h-full p-1 sm:p-2">
                <RestaurantGridSkeleton count={3} className="grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3" compact />
              </LoadingSkeletonRegion>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className={`grid grid-cols-1 items-stretch gap-5 px-4 pt-1 transition-opacity duration-300 sm:gap-4 sm:pt-1.5 md:grid-cols-2 lg:gap-5 lg:pt-2 lg:grid-cols-3 xl:gap-6 ${
            isLoadingFilterResults || loadingRestaurants ? "opacity-50" : "opacity-100"
          }`}
        >
          {visibleRestaurants.map((restaurant, index) => (
            <FoodRestaurantCard
              key={restaurant?.id || restaurant?._id || restaurant?.slug || index}
              restaurant={restaurant}
              index={index}
              isOutOfService={isOutOfService}
              currentDate={currentDate}
              isFavorite={isFavorite}
              onFavoriteToggle={onFavoriteToggle}
              backendOrigin={backendOrigin}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 px-4 pt-4 pb-28 sm:pt-6">
        {hasMoreRestaurants && (
          <button
            onClick={loadMoreRestaurants}
            disabled={loadingRestaurants}
            className="w-full max-w-xs rounded-2xl border-2 border-[#FE5502] bg-white py-3 text-sm font-bold text-[#FE5502] shadow-sm transition-all duration-200 hover:bg-orange-50 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loadingRestaurants ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FE5502] border-t-transparent" />
                Loading...
              </>
            ) : (
              "Load More Restaurants"
            )}
          </button>
        )}
        {!hasMoreRestaurants && visibleRestaurants.length > 0 && (
          <p className="text-xs text-gray-400 font-medium py-2">You've seen all restaurants</p>
        )}
      </div>
    </section>
  );
});

export default RestaurantGrid;
