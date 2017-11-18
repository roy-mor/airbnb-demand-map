import consts from './constants';

function getStarRatingWeight(reviewsCount) {
    if (!reviewsCount || reviewsCount <= 2) return 0; // star_rating is non null only when reviews_count > 2
    if (reviewsCount <= 10) return 0.1;
    if (reviewsCount <= 20) return 0.15;
    if (reviewsCount >= 21) return 0.2;
}   

function getFinalDemandScoreForListing({starRating, reviewsCount, occupancyScore, avgNightlyPrice, isSuperHost, minLocationPrice, maxLocationPrice}) {
    const starRatingWeight = getStarRatingWeight(reviewsCount);
    const restWeight = 1 - starRatingWeight; // all other parameters combined ('rest') will have this weight
    starRating = starRating || 0;
    const normalizedRating = normalize(0, 5)(starRating) * starRatingWeight;
    const normalizedOccupancy = normalize(0, consts.FULL_CALENDAR_DAYS)(occupancyScore);
    const normalizedPrice = normalize(minLocationPrice, maxLocationPrice)(avgNightlyPrice);
    const normalizedIsSuperHost = isSuperHost ? 1 : 0;
    const normalizedRestScore = (0.65 * normalizedOccupancy) + (0.25 * normalizedPrice) + (0.1 * normalizedIsSuperHost);
    const finalScore = (restWeight * normalizedRestScore) + normalizedRating;
    return finalScore;
}

/* returns a function that re-scales values between 0 and 1*/
function normalize(min, max) {
    const delta = (max - min) === 0 ? 1 : max - min;
    return function(val) {
        return (val - min) / delta;
    };
}

module.exports = { getFinalDemandScoreForListing };
