import fs from 'fs'; // TODO REMOVE
import util from 'util';
import consts from './constants';
/* The weight of star rating in the final demand metric for a listing is dependent upon the number of reviews 
which resulted in the star rating (statistical significance). 
TODO FIX
//

It is not necessarily a linear function: I've decided that 3 reviews or less will give their star rating only
a 10% weight; between 4 and 10 reviews will give a 25% weight; between 11 and 20 reviews will increase to a 
33% weight; and any number of reviews over 21 gives the star rating a strong significance of 40% for of the 
final demand score.*/
function getStarRatingWeight(reviewsCount) {
	if (!reviewsCount || reviewsCount <= 2) return 0; // star_rating is non null only when reviews_count > 2
	if (reviewsCount <= 10) return 0.1;
	if (reviewsCount <= 20) return 0.15;
	if (reviewsCount >= 21) return 0.2;
}

// starRatingWeight is determined by number of reviews. 
// (100% - starRatingWeight) * (65% OCCUPANCY SCORE + 25% PRICE + 10% EXTRA IF SUPERHOST) + (STAR RATING percentage by StarRatingWeight)



//TODO mocha test this
//assumes uniform distribution of prices in the city
function getFinalDemandScoreForListing({
	starRating,
	reviewsCount,
	occupancyScore,
	avgNightlyPrice,
	isSuperHost,
	minLocationPrice,
	maxLocationPrice
}) {
	const starRatingWeight = getStarRatingWeight(reviewsCount);
	const restWeight = 1 - starRatingWeight; // all other parameters combined will have this weight
	starRating = starRating || 0;
	const normalizedRating = normalize(0, 5)(starRating) * starRatingWeight;

	const normalizedOccupancy = normalize(0, consts.FULL_CALENDAR_DAYS)(occupancyScore);
	//price may reflect WTP and also on average high demand areas tend to have higher prices 
	//(because of the demand) (confusing cause and effect, but..) 
	// two listing with the same occupancyScore, the more expensive one should get higher demand score
	const normalizedPrice = normalize(minLocationPrice, maxLocationPrice)(avgNightlyPrice);
	const normalizedIsSuperHost = isSuperHost ? 1 : 0;
	const normalizedRestScore = (0.65 * normalizedOccupancy) + (0.25 * normalizedPrice) + (0.1 * normalizedIsSuperHost);
	const finalScore = (restWeight * normalizedRestScore) + normalizedRating;

	if (finalScore > 1) console.log('ERROR ITS MORE THAN 1!!!!!!!!!!!!!!!!!!1');
	console.log(`starRating: ${starRating}, reviewsCount: ${reviewsCount}, occupancyScore: ${occupancyScore}`);
	console.log(`avgPrice: ${avgNightlyPrice}, isSuperHost: ${isSuperHost}`);
	console.log(`(0.65 * normalizedOccupancy (${normalizedOccupancy})) + (0.25 * normalizedPrice (${normalizedPrice})) + (0.1 * normalizedIsSuperHost (${normalizedIsSuperHost}))`);
	console.log(`final score = restWeight (${restWeight}) * normalizedRestScore (${normalizedRestScore}) + normalizedRating (${normalizedRating})`);
	console.log(`-----`);
	console.log(`normalizedRestScore: ${normalizedRestScore}, normalizedRating: ${normalizedRating}`)
	console.log(`====> FINAL SCORE: ${finalScore}\n\n`);

	return finalScore;
}

/* returns a function that re-scales values between 0 and 1*/
function normalize(min, max) {
	const delta = (max - min) === 0 ? 1 : max - min;
	return function(val) {
		return (val - min) / delta;
	};
}

module.exports = {
	getFinalDemandScoreForListing
};

//DEBUG FUNCTIONS:
//TODO temp debug, delete this:
console.log = function() {
	logFile.write(util.format.apply(null, arguments) + '\n');
	logStdout.write(util.format.apply(null, arguments) + '\n');
};
const logFile = fs.createWriteStream('./metrics.txt', {
	flags: 'w'
}); //append to file
const logStdout = process.stdout;