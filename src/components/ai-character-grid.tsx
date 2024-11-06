"use client"

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { AllCharacterTags, CharacterTag, CharacterTags, NSFWCharacterTags, SFWCharacterTags } from "@/types/character-tags";
import { searchCharactersByTags } from "@/app/actions/index";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

type Character = {
  id: string;
  name: string;
  tagline: string;
  avatar_image_url: string | null;
  interactionCount: number;
  createdAt: Date;
  userName: string | null;
  userId: string;
  tags: string | string[] | null;
};

type PaginationInfo = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

interface AICharacterGridProps {
  initialCharacters: Character[];
  paginationInfo: PaginationInfo;
  totalPublicCharacters: number;
}

const parseTags = (tags: string | string[] | null): string[] => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [tags];
  }
};

type SortOption = "popular" | "new" | "old";

const safeTruncate = (str: string, n: number) => {
  if (str.length <= n) return str;
  const subString = str.slice(0, n - 1);
  return (
    (subString.match(/[\uD800-\uDBFF]$/) ? subString.slice(0, -1) : subString) +
    "…"
  );
};

const AICharacterCard: React.FC<{ character: Character }> = ({ character }) => {
  const truncatedTagline = React.useMemo(
    () => safeTruncate(character.tagline, 150),
    [character.tagline],
  );
  const [showNSFW, setShowNSFW] = useState(false);

  const characterTags = parseTags(character.tags);
  const isNSFW = characterTags.some(tag => NSFWCharacterTags.includes(tag as any));

  const [shouldBlur, setShouldBlur] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("nsfw") !== "true" && isNSFW;
    }
    return isNSFW;
  });

  const handleViewNSFW = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShouldBlur(false);
    setShowNSFW(true);
  };

  return (
    <Link
      href={`/chat/${character.id}`}
      passHref
      className="block w-full h-full"
    >
      <Card className="bg-neutral-800 overflow-hidden rounded-lg h-full flex flex-col">
        <CardContent className="flex flex-col px-0 flex-grow">
          <div className="relative w-full pb-[100%] rounded-lg overflow-hidden">
            <Image
              src={character.avatar_image_url ?? "/default-avatar.jpg"}
              alt={character.name}
              layout="fill"
              objectFit="cover"
              className={`overflow-hidden border h-full w-full transition-all duration-200 ${
                shouldBlur ? 'blur-xl' : ''
              }`}
            />
            {shouldBlur && (
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={handleViewNSFW}
                  className="bg-black text-white px-2 py-2 rounded-lg text-[8px] font-medium hover:bg-gray-900 transition-colors duration-200"
                >
                  View NSFW Content
                </button>
              </div>
            )}
          </div>
          <div className="px-1">
            <h3 className="mt-2 text-xs font-semibold text-gray-200 truncate text-wrap break-words">
              {character.name}
            </h3>
            {isNSFW && (
              <div className="mt-1 mb-2">
                <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] rounded inline-block">
                  NSFW
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 w-full px-1 flex-grow">
            {truncatedTagline}
          </p>
        </CardContent>
        <div className="flex items-center text-xs text-gray-500 mt-1 w-full justify-between px-2 py-2">
          <Link href={`/public-profile/${character.userId}`} className="hover:underline hover:text-blue-600">@{character.userName}</Link>
          <div className="flex items-center">
            <MessageCircle className="w-3 h-3 mr-1" />
            <span>{character.interactionCount}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
};

const CustomPagination: React.FC<{
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalPages, onPageChange }) => {
  const maxVisiblePages = 5;
  const showLeftEllipsis = currentPage > 3;
  const showRightEllipsis = currentPage < totalPages - 2;

  const getVisiblePages = () => {
    const pages = [];
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 3; i++) {
          pages.push(i);
        }
      } else if (currentPage >= totalPages - 2) {
        for (let i = totalPages - 2; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(currentPage - 1, currentPage, currentPage + 1);
      }
    }
    return pages;
  };

  return (
    <Pagination className="my-8 text-xs">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={() => onPageChange(currentPage - 1)}
            className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
          />
        </PaginationItem>

        {showLeftEllipsis && (
          <>
            <PaginationItem>
              <PaginationLink onClick={() => onPageChange(1)}>1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          </>
        )}

        {getVisiblePages().map((page) => (
          <PaginationItem key={page}>
            <PaginationLink
              className="cursor-pointer"
              onClick={() => onPageChange(page)}
              isActive={currentPage === page}
            >
              {page}
            </PaginationLink>
          </PaginationItem>
        ))}

        {showRightEllipsis && (
          <>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink onClick={() => onPageChange(totalPages)}>
                {totalPages}
              </PaginationLink>
            </PaginationItem>
          </>
        )}

        <PaginationItem>
          <PaginationNext
            onClick={() => onPageChange(currentPage + 1)}
            className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
};

const AICharacterGrid: React.FC<AICharacterGridProps> = ({
  initialCharacters,
  paginationInfo,
  totalPublicCharacters
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    return (searchParams.get('sort') as SortOption) || "popular";
  });
  const [showTags, setShowTags] = useState(false);
  const [characters, setCharacters] = useState<Character[]>(initialCharacters);
  const [pagination, setPagination] = useState<PaginationInfo>(paginationInfo);
  const [isLoading, setIsLoading] = useState(false);

  const activeTags = useMemo(() => {
    const tags = searchParams.get('tags');
    if (tags) {
      setShowTags(true)
    }
    console.log('Current tags from URL:', tags);
    return tags ? tags.split(',') : [];
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [searchParams, router]);

  const updateUrlWithFilters = (page: number, sort: SortOption, tags: string[]) => {
    console.log('Updating URL with tags:', tags);
    const params = new URLSearchParams();
    params.set('id', Math.random().toString(36).substring(7));
    params.set('page', page.toString());
    params.set('sort', sort);
    if (tags.length > 0) {
      params.set('tags', tags.join(','));
    }
    router.push(`/?${params.toString()}`);
  };

  const Button: React.FC<{ label: string; isActive: boolean; onClick: () => void }> = ({ label, isActive, onClick }) => (
    <div
      className={`text-sm font-semibold text-white rounded-lg p-2 text-center hover:cursor-pointer transition-colors duration-200 ${
        isActive ? "bg-black" : "bg-neutral-800 hover:bg-gray-700"
      }`}
      onClick={onClick}
    >
      {label}
    </div>
  );

  const CharacterTypeButton: React.FC<{ tag: CharacterTag }> = ({ tag }) => {
    const isActive = activeTags.includes(tag);
    
    const handleClick = () => {
      let newTags: string[];
      if (isActive) {
        console.log('Removing tag:', tag);
        newTags = activeTags.filter(t => t !== tag);
      } else {
        console.log('Adding tag:', tag);
        newTags = [...activeTags, tag];
      }
      console.log('New tags after update:', newTags);
      updateUrlWithFilters(1, sortOption, newTags);
    };

    return (
      <div
        className={`text-sm font-semibold text-white rounded-lg p-2 text-center hover:cursor-pointer transition-colors duration-200 ${
          isActive ? "bg-black" : "bg-neutral-800 hover:bg-gray-700"
        }`}
        onClick={handleClick}
      >
        {tag.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </div>
    );
  };

  const handleReset = () => {
    console.log('Resetting all tags');
    router.push('/');
  };

  const handlePageChange = (page: number) => {
    updateUrlWithFilters(page, sortOption, activeTags);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSortChange = (newSort: SortOption) => {
    setSortOption(newSort);
    updateUrlWithFilters(1, newSort, activeTags);
  };

  return (
    <div className="bg-neutral-900">
      <div className="w-full flex flex-wrap gap-2 mb-4">
        <Button 
          label="Popular" 
          isActive={sortOption === "popular"} 
          onClick={() => handleSortChange("popular")} 
        />
        <Button 
          label="New" 
          isActive={sortOption === "new"} 
          onClick={() => handleSortChange("new")} 
        />
        <Button 
          label="Old" 
          isActive={sortOption === "old"} 
          onClick={() => handleSortChange("old")} 
        />
        <Button 
          label="Tags" 
          isActive={showTags} 
          onClick={() => setShowTags(!showTags)} 
        />
        <Button 
          label="Leaderboard" 
          onClick={() => router.push("/leaderboard")} 
          isActive={false} 
        />
        {activeTags.length > 0 && (
          <Button label="Reset Tags" isActive={false} onClick={handleReset} />
        )}
      </div>

      {showTags && (
        <div className="w-full flex flex-wrap gap-2 mb-4 overflow-x-auto">
          {AllCharacterTags.map((tag) => (
            <CharacterTypeButton key={tag} tag={tag} />
          ))}
        </div>
      )}
    
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {Array.from({ length: 24 }).map((_, index) => (
            <div key={index} className="bg-neutral-800 rounded-lg h-64 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {characters.map((character) => (
            <AICharacterCard key={character.id} character={character} />
          ))}
        </div>
      )}

      <div className="flex flex-col items-center gap-6 mt-8">
        {pagination.totalPages > 1 && (
          <CustomPagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
          />
        )}
        
        <div className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium text-white bg-black rounded-full border-2 border-gradient-to-r from-pink-500 via-purple-500 to-blue-500 mb-8">
          {totalPublicCharacters.toLocaleString()} total public characters
        </div>
      </div>
      
      <div className="border-t border-gray-700 mt-8" />
    </div>
  );
};

export default AICharacterGrid;